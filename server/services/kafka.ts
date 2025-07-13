import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from '../storage';
import { MessageType, OrderStatus } from '@shared/schema';

export class KafkaService {
  private kafka: Kafka;
  private consumer: Consumer;
  private wss: WebSocketServer | null = null;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'order-monitor',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      connectionTimeout: 3000,
      requestTimeout: 25000,
    });

    this.consumer = this.kafka.consumer({ groupId: 'order-monitor-group' });
  }

  async initialize(webSocketServer: WebSocketServer) {
    this.wss = webSocketServer;
    
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [
          process.env.KAFKA_ORDER_TOPIC || 'order-updates',
          process.env.KAFKA_STATUS_TOPIC || 'order-status',
        ],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleMessage(topic, message);
        },
      });

      this.isConnected = true;
      console.log('Kafka consumer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Kafka consumer:', error);
      this.isConnected = false;
    }
  }

  private async handleMessage(topic: string, message: KafkaMessage) {
    try {
      const messageValue = message.value?.toString();
      if (!messageValue) return;

      const data = JSON.parse(messageValue);
      
      if (topic === (process.env.KAFKA_ORDER_TOPIC || 'order-updates')) {
        await this.handleOrderUpdate(data);
      } else if (topic === (process.env.KAFKA_STATUS_TOPIC || 'order-status')) {
        await this.handleStatusUpdate(data);
      }
    } catch (error) {
      console.error('Error handling Kafka message:', error);
    }
  }

  private async handleOrderUpdate(data: any) {
    try {
      const order = await storage.updateOrder(data.orderId, {
        status: data.status,
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        itemCount: data.itemCount,
      });

      if (order) {
        // Add status history entry
        await storage.addOrderStatusHistory({
          orderId: data.orderId,
          status: data.status,
          title: this.getStatusTitle(data.status),
          description: data.description || this.getStatusDescription(data.status),
          operator: data.operator || 'System',
          duration: data.duration,
        });

        // Add message
        await storage.addOrderMessage({
          orderId: data.orderId,
          messageType: MessageType.STATUS_UPDATE,
          content: `Order status updated to ${data.status}`,
          metadata: data.metadata || {},
        });

        this.broadcastToClients({
          type: 'order_update',
          data: order,
        });
      }
    } catch (error) {
      console.error('Error handling order update:', error);
    }
  }

  private async handleStatusUpdate(data: any) {
    try {
      await storage.addOrderMessage({
        orderId: data.orderId,
        messageType: data.messageType || MessageType.INFO,
        content: data.content,
        metadata: data.metadata || {},
      });

      this.broadcastToClients({
        type: 'message_update',
        data: {
          orderId: data.orderId,
          messageType: data.messageType,
          content: data.content,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error handling status update:', error);
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

  private broadcastToClients(message: any) {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  async disconnect() {
    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log('Kafka consumer disconnected');
    } catch (error) {
      console.error('Error disconnecting Kafka consumer:', error);
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const kafkaService = new KafkaService();
