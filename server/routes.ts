import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { mockKafkaService } from "./services/mock-kafka";
import { insertOrderSchema, insertOrderMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info: any) => {
      // Accept all connections for demo purposes
      return true;
    }
  });

  // Initialize Mock Kafka service with WebSocket server
  await mockKafkaService.initialize(wss);

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe_order') {
          // Handle order subscription
          const order = await storage.getOrder(data.orderId);
          if (order) {
            ws.send(JSON.stringify({
              type: 'order_data',
              data: order,
            }));
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });

    // Send connection status
    ws.send(JSON.stringify({
      type: 'connection_status',
      connected: mockKafkaService.getConnectionStatus(),
    }));
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
      res.status(500).json({ error: 'Failed to fetch status history' });
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
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: 'Invalid order data' });
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

  app.get('/api/kafka/status', (req, res) => {
    res.json({ connected: mockKafkaService.getConnectionStatus() });
  });

  // Manual trigger for order status update (for demo purposes)
  app.post('/api/orders/:orderId/trigger-update', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      await mockKafkaService.triggerOrderUpdate(orderId, status);
      res.json({ success: true, message: `Order ${orderId} updated to ${status}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger order update' });
    }
  });

  return httpServer;
}
