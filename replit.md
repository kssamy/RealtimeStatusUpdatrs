# Order Monitor System

## Overview

This is a real-time order monitoring system built with React and Express that tracks order status and provides live updates through Server-Sent Events (SSE). The system integrates with Kafka for message streaming and uses PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and building
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Real-time Communication**: Server-Sent Events (SSE) client for live updates

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Real-time Communication**: Server-Sent Events (SSE) endpoint for live updates
- **Message Streaming**: Kafka integration for order event processing
- **Session Management**: PostgreSQL session store using connect-pg-simple

## Key Components

### Database Schema
- **Orders**: Stores order information including ID, customer details, amount, status, and timestamps
- **Order Messages**: Tracks message history for each order with type, content, and metadata
- **Order Status History**: Maintains audit trail of status changes with operator info and timestamps

### Real-time Communication
- **Server-Sent Events (SSE)**: Provides real-time updates via HTTP streaming at `/api/events`
- **Kafka Consumer**: Processes order events from Kafka topics and broadcasts to connected clients
- **Message Types**: Supports order updates, status changes, and connection status messages
- **Auto-reconnection**: Built-in browser reconnection handling for improved reliability

### Frontend Components
- **Order Monitor**: Main dashboard for tracking orders with search, filtering, and real-time updates
- **UI Components**: Comprehensive set of accessible UI components from Radix UI
- **Toast Notifications**: User feedback system for actions and errors

## Data Flow

1. **Order Events**: Kafka produces order events to configured topics
2. **Event Processing**: Backend Kafka consumer processes events and updates database
3. **Real-time Updates**: SSE endpoint broadcasts updates to connected clients via HTTP streaming
4. **UI Updates**: Frontend receives SSE messages and updates the interface
5. **User Interactions**: Users can search, filter, and track specific orders

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver for serverless environments
- **kafkajs**: Kafka client for message streaming
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: HTTP server framework with SSE streaming support

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library

## Deployment Strategy

### Development
- **Dev Server**: Vite development server with hot module replacement
- **Backend**: Express server with TypeScript compilation via tsx
- **Database**: PostgreSQL with Drizzle migrations

### Production
- **Build Process**: Vite builds frontend assets, esbuild bundles backend
- **Runtime**: Node.js serves both API and static files
- **Database**: PostgreSQL with connection pooling
- **Environment**: Configured via environment variables for database URL and Kafka brokers

### Configuration
- **Database**: Configured via `DATABASE_URL` environment variable
- **Kafka**: Configurable brokers and topics via environment variables
- **Server-Sent Events**: HTTP-based streaming endpoint at `/api/events` for real-time communication

The system is designed to be scalable and maintainable, with clear separation between frontend and backend concerns, type safety throughout, and real-time capabilities for monitoring order status changes.