import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  totalAmount: text("total_amount").notNull(),
  itemCount: integer("item_count").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderMessages = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  messageType: text("message_type").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  operator: text("operator").notNull(),
  duration: text("duration"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderMessageSchema = createInsertSchema(orderMessages).omit({
  id: true,
  timestamp: true,
});

export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({
  id: true,
  timestamp: true,
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderMessage = typeof orderMessages.$inferSelect;
export type InsertOrderMessage = z.infer<typeof insertOrderMessageSchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;

export const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const MessageType = {
  STATUS_UPDATE: 'status_update',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const;
