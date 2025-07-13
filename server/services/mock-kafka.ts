import { WebSocketServer, WebSocket } from 'ws';
import { storage } from '../storage';
import { MessageType, OrderStatus } from '@shared/schema';

export class MockKafkaService {
  private wss: WebSocketServer | null = null;
  private isConnected = false;
  private messageInterval: NodeJS.Timeout | null = null;

  constructor() {
    // No actual Kafka connection needed for demo
  }

  async initialize(webSocketServer: WebSocketServer) {
    this.wss = webSocketServer;
    this.isConnected = true;
    console.log('Mock Kafka service initialized successfully');
    
    // Start simulating messages every 10 seconds
    this.startMessageSimulation();
  }

  private startMessageSimulation() {
    // Simulate periodic order updates
    this.messageInterval = setInterval(async () => {
      await this.simulateOrderUpdate();
    }, 10000); // Every 10 seconds
  }

  private async simulateOrderUpdate() {
    const sampleOrders = ['ORD-2024-001', 'ORD-2024-002', 'ORD-2024-003'];
    const randomOrderId = sampleOrders[Math.floor(Math.random() * sampleOrders.length)];
    
    // Simulate status progression
    const statusProgression = {
      'pending': 'confirmed',
      'confirmed': 'processing', 
      'processing': 'shipped',
      'shipped': 'delivered'
    };

    try {
      const currentOrder = await storage.getOrder(randomOrderId);
      if (currentOrder && statusProgression[currentOrder.status as keyof typeof statusProgression]) {
        const newStatus = statusProgression[currentOrder.status as keyof typeof statusProgression];
        
        const updatedOrder = await storage.updateOrder(randomOrderId, {
          status: newStatus,
        });

        if (updatedOrder) {
          // Add status history
          await storage.addOrderStatusHistory({
            orderId: randomOrderId,
            status: newStatus,
            title: this.getStatusTitle(newStatus),
            description: this.getStatusDescription(newStatus),
            operator: 'System',
            duration: this.getRandomDuration(),
          });

          // Add message
          await storage.addOrderMessage({
            orderId: randomOrderId,
            messageType: MessageType.STATUS_UPDATE,
            content: `Order status updated to ${newStatus}`,
            metadata: { simulatedUpdate: true },
          });

          // Broadcast to connected clients
          this.broadcastToClients({
            type: 'order_update',
            data: updatedOrder,
          });

          console.log(`Simulated order update: ${randomOrderId} -> ${newStatus}`);
        }
      }
    } catch (error) {
      console.error('Error simulating order update:', error);
    }
  }

  private getStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      [OrderStatus.PENDING]: 'Order Placed',
      [OrderStatus.CONFIRMED]: 'Order Confirmed',
      [OrderStatus.PROCESSING]: 'Processing',
      [OrderStatus.SHIPPED]: 'Shipped',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled',
    };
    return titles[status] || 'Status Update';
  }

  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      [OrderStatus.PENDING]: 'Your order has been placed and is awaiting confirmation.',
      [OrderStatus.CONFIRMED]: 'Your order has been confirmed and is being prepared for processing.',
      [OrderStatus.PROCESSING]: 'Items are being prepared and packaged for shipment.',
      [OrderStatus.SHIPPED]: 'Your order has been shipped and is on its way.',
      [OrderStatus.DELIVERED]: 'Your order has been delivered successfully.',
      [OrderStatus.CANCELLED]: 'Your order has been cancelled.',
    };
    return descriptions[status] || 'Status has been updated.';
  }

  private getRandomDuration(): string {
    const durations = ['2m', '5m', '15m', '30m', '1h', '2h'];
    return durations[Math.floor(Math.random() * durations.length)];
  }

  private broadcastToClients(message: any) {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  async disconnect() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
    this.isConnected = false;
    console.log('Mock Kafka service disconnected');
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  // Method to manually trigger an order update (for testing)
  async triggerOrderUpdate(orderId: string, newStatus: string) {
    const order = await storage.updateOrder(orderId, { status: newStatus });
    if (order) {
      await storage.addOrderStatusHistory({
        orderId,
        status: newStatus,
        title: this.getStatusTitle(newStatus),
        description: this.getStatusDescription(newStatus),
        operator: 'Manual',
        duration: this.getRandomDuration(),
      });

      await storage.addOrderMessage({
        orderId,
        messageType: MessageType.STATUS_UPDATE,
        content: `Order status manually updated to ${newStatus}`,
        metadata: { manualUpdate: true },
      });

      this.broadcastToClients({
        type: 'order_update',
        data: order,
      });
    }
  }
}

export const mockKafkaService = new MockKafkaService();