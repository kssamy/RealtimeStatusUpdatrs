import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mockKafkaService } from "./services/mock-kafka";
import { insertOrderSchema, insertOrderMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Store SSE connections
  const sseClients = new Set<Response>();

  // Initialize Mock Kafka service with SSE broadcast function
  await mockKafkaService.initialize((message: any) => {
    // Broadcast to all SSE clients
    sseClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE message:', error);
        sseClients.delete(client);
      }
    });
  });

  // SSE endpoint for real-time updates
  app.get('/api/events', (req: Request, res: Response) => {
    console.log('Client connected to SSE');
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Prevent request timeout
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Send status immediately
    res.status(200);

    // Add client to active connections
    sseClients.add(res);

    // Send initial connection status
    try {
      res.write(`data: ${JSON.stringify({
        type: 'connection_status',
        connected: mockKafkaService.getConnectionStatus(),
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      console.error('Error sending initial SSE message:', error);
      sseClients.delete(res);
      return;
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from SSE');
      sseClients.delete(res);
    });

    req.on('error', (error) => {
      console.error('SSE request error:', error);
      sseClients.delete(res);
    });

    res.on('error', (error) => {
      console.error('SSE response error:', error);
      sseClients.delete(res);
    });
  });

  // REST API endpoints
  app.get('/api/orders/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  app.get('/api/orders/:orderId/messages', async (req, res) => {
    try {
      const { orderId } = req.params;
      const messages = await storage.getOrderMessages(orderId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/orders/:orderId/history', async (req, res) => {
    try {
      const { orderId } = req.params;
      const history = await storage.getOrderStatusHistory(orderId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const orders = await storage.getRecentOrders(limit);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: 'Invalid order data' });
    }
  });

  app.post('/api/orders/:orderId/trigger-update', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      await mockKafkaService.triggerOrderUpdate(orderId, status);
      res.json({ success: true, message: 'Order update triggered' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger update' });
    }
  });

  app.delete('/api/orders/:orderId/messages', async (req, res) => {
    try {
      const { orderId } = req.params;
      await storage.clearOrderMessages(orderId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear messages' });
    }
  });

  return httpServer;
}