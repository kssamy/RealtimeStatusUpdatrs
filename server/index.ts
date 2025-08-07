import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create default orders on startup
  const existingOrders = await storage.getRecentOrders(5);
  if (existingOrders.length === 0) {
    console.log('Creating default orders...');
    await storage.createOrder({
      orderId: 'ORD-2024-001',
      customerId: 'CUST-123',
      customerName: 'John Doe',
      status: 'pending',
      totalAmount: '89.99',
      itemCount: 3,
    });
    await storage.createOrder({
      orderId: 'ORD-2024-002',
      customerId: 'CUST-456',
      customerName: 'Jane Smith',
      status: 'confirmed',
      totalAmount: '159.50',
      itemCount: 2,
    });
    await storage.createOrder({
      orderId: 'ORD-2024-003',
      customerId: 'CUST-789',
      customerName: 'Bob Johnson',
      status: 'processing',
      totalAmount: '45.00',
      itemCount: 1,
    });
    console.log('Default orders created');
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
