import {
  orders,
  orderMessages,
  orderStatusHistory,
  type Order,
  type InsertOrder,
  type OrderMessage,
  type InsertOrderMessage,
  type OrderStatusHistory,
  type InsertOrderStatusHistory,
} from "@shared/schema";

export interface IStorage {
  // Order operations
  getOrder(orderId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(orderId: string, updates: Partial<InsertOrder>): Promise<Order | undefined>;
  getRecentOrders(limit?: number): Promise<Order[]>;

  // Message operations
  getOrderMessages(orderId: string): Promise<OrderMessage[]>;
  addOrderMessage(message: InsertOrderMessage): Promise<OrderMessage>;
  clearOrderMessages(orderId: string): Promise<void>;

  // Status history operations
  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]>;
  addOrderStatusHistory(history: InsertOrderStatusHistory): Promise<OrderStatusHistory>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order>;
  private messages: Map<string, OrderMessage[]>;
  private statusHistory: Map<string, OrderStatusHistory[]>;
  private currentId: number;

  constructor() {
    this.orders = new Map();
    this.messages = new Map();
    this.statusHistory = new Map();
    this.currentId = 1;
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    const order: Order = {
      ...insertOrder,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(insertOrder.orderId, order);
    return order;
  }

  async updateOrder(orderId: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    const updatedOrder: Order = {
      ...order,
      ...updates,
      updatedAt: new Date(),
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async getRecentOrders(limit = 10): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values());
    return allOrders
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async getOrderMessages(orderId: string): Promise<OrderMessage[]> {
    return this.messages.get(orderId) || [];
  }

  async addOrderMessage(insertMessage: InsertOrderMessage): Promise<OrderMessage> {
    const id = this.currentId++;
    const message: OrderMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      metadata: insertMessage.metadata || null,
    };

    const orderMessages = this.messages.get(insertMessage.orderId) || [];
    orderMessages.push(message);
    this.messages.set(insertMessage.orderId, orderMessages);

    return message;
  }

  async clearOrderMessages(orderId: string): Promise<void> {
    this.messages.delete(orderId);
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    return this.statusHistory.get(orderId) || [];
  }

  async addOrderStatusHistory(insertHistory: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    const id = this.currentId++;
    const history: OrderStatusHistory = {
      ...insertHistory,
      id,
      timestamp: new Date(),
      duration: insertHistory.duration || null,
    };

    const orderHistory = this.statusHistory.get(insertHistory.orderId) || [];
    orderHistory.push(history);
    this.statusHistory.set(insertHistory.orderId, orderHistory);

    return history;
  }
}

export const storage = new MemStorage();
