import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mockKafkaService } from "./services/mock-kafka";
import { insertOrderSchema, insertOrderMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Store SSE connections with their subscriptions
  interface SSEClient {
    response: Response;
    subscribedOrders: Set<string>; // Orders this client is tracking
    clientId: string;
  }
  const sseClients = new Map<string, SSEClient>();

  // Initialize Mock Kafka service with targeted SSE broadcast function
  await mockKafkaService.initialize((message: any) => {
    if (message.type === 'order_update') {
      const orderId = message.data.orderId;
      let sentCount = 0;
      
      // Only send to clients tracking this specific order
      sseClients.forEach(client => {
        if (client.subscribedOrders.has(orderId)) {
          try {
            client.response.write(`data: ${JSON.stringify(message)}\n\n`);
            sentCount++;
          } catch (error) {
            console.error('Error sending SSE message:', error);
            sseClients.delete(client.clientId);
          }
        }
      });
      
      console.log(`SSE targeted broadcast: ${orderId} sent to ${sentCount}/${sseClients.size} clients`);
    } else {
      // Broadcast connection status to all clients
      sseClients.forEach(client => {
        try {
          client.response.write(`data: ${JSON.stringify(message)}\n\n`);
        } catch (error) {
          console.error('Error sending SSE message:', error);
          sseClients.delete(client.clientId);
        }
      });
    }
  });

  // SSE endpoint for real-time updates with order subscription
  app.get('/api/events', (req: Request, res: Response) => {
    const orderId = req.query.orderId as string;
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Client ${clientId} connected to SSE${orderId ? ` for order ${orderId}` : ''}`);
    
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

    // Create client with subscription info
    const client: SSEClient = {
      response: res,
      subscribedOrders: new Set(orderId ? [orderId] : []),
      clientId: clientId
    };
    
    // Add client to active connections
    sseClients.set(clientId, client);

    // Send initial connection status
    try {
      res.write(`data: ${JSON.stringify({
        type: 'connection_status',
        connected: mockKafkaService.getConnectionStatus(),
        timestamp: new Date().toISOString(),
        clientId: clientId,
        subscribedTo: orderId || 'all_orders'
      })}\n\n`);
    } catch (error) {
      console.error('Error sending initial SSE message:', error);
      sseClients.delete(clientId);
      return;
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log(`Client ${clientId} disconnected from SSE`);
      sseClients.delete(clientId);
    });

    req.on('error', (error) => {
      console.error('SSE request error:', error);
      sseClients.delete(clientId);
    });

    res.on('error', (error) => {
      console.error('SSE response error:', error);
      sseClients.delete(clientId);
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

  // Endpoint to subscribe to specific orders
  app.post('/api/events/subscribe', (req: Request, res: Response) => {
    const { clientId, orderId } = req.body;
    
    if (!clientId || !orderId) {
      return res.status(400).json({ error: "clientId and orderId required" });
    }
    
    const client = sseClients.get(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    client.subscribedOrders.add(orderId);
    console.log(`Client ${clientId} subscribed to order ${orderId}`);
    
    return res.json({ success: true, message: `Subscribed to order ${orderId}` });
  });

  // Endpoint to unsubscribe from specific orders  
  app.post('/api/events/unsubscribe', (req: Request, res: Response) => {
    const { clientId, orderId } = req.body;
    
    if (!clientId || !orderId) {
      return res.status(400).json({ error: "clientId and orderId required" });
    }
    
    const client = sseClients.get(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    client.subscribedOrders.delete(orderId);
    console.log(`Client ${clientId} unsubscribed from order ${orderId}`);
    
    return res.json({ success: true, message: `Unsubscribed from order ${orderId}` });
  });

  return httpServer;
}