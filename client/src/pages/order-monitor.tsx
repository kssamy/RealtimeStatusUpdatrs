import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  Play, 
  Pause, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  MessageCircle, 
  Mail, 
  Calendar, 
  User, 
  Trash2, 
  Cog,
  Loader2
} from "lucide-react";
import type { Order, OrderMessage, OrderStatusHistory } from "@shared/schema";

export default function OrderMonitor() {
  const [orderId, setOrderId] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState("5");
  const [autoScroll, setAutoScroll] = useState(true);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current order data
  const { data: currentOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['/api/orders', currentOrderId],
    enabled: !!currentOrderId,
  });

  // Fetch order messages
  const { data: orderMessages = [] } = useQuery({
    queryKey: ['/api/orders', currentOrderId, 'messages'],
    enabled: !!currentOrderId,
  });

  // Fetch status history
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['/api/orders', currentOrderId, 'history'],
    enabled: !!currentOrderId,
  });

  // Fetch recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['/api/orders'],
    refetchInterval: 30000,
  });

  // WebSocket connection
  useEffect(() => {
    if (!isTracking) return;

    // Use the correct WebSocket URL for development and production
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = process.env.NODE_ENV === "development" 
      ? `ws://localhost:5000/ws`
      : `${protocol}//${window.location.host}/ws`;
    
    try {
      setShowLoading(true);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setShowLoading(false);
        setShowError(false);
        console.log('WebSocket connected successfully');
        toast({
          title: "Connected",
          description: "Real-time updates connected",
        });
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'order_update') {
          // Invalidate all related queries for real-time updates
          queryClient.invalidateQueries({ queryKey: ['/api/orders', data.data.orderId] });
          queryClient.invalidateQueries({ queryKey: ['/api/orders', data.data.orderId, 'history'] });
          queryClient.invalidateQueries({ queryKey: ['/api/orders', data.data.orderId, 'messages'] });
          queryClient.invalidateQueries({ queryKey: ['/api/orders'] }); // Refresh recent orders too
          
          toast({
            title: "Order Updated",
            description: `Order ${data.data.orderId} status changed to ${data.data.status}`,
          });
        } else if (data.type === 'message_update') {
          setMessages(prev => [...prev, data.data]);
          queryClient.invalidateQueries({ queryKey: ['/api/orders', data.data.orderId, 'messages'] });
        } else if (data.type === 'connection_status') {
          setIsConnected(data.connected);
        } else if (data.type === 'order_data') {
          // Handle initial order data when subscribing
          queryClient.setQueryData(['/api/orders', data.data.orderId], data.data);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setShowLoading(false);
        console.log('WebSocket connection closed');
      };

      wsRef.current.onerror = (error) => {
        setIsConnected(false);
        setShowLoading(false);
        setShowError(true);
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      setShowLoading(false);
      setShowError(true);
      console.error('WebSocket connection failed:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isTracking, queryClient, toast]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [orderMessages, autoScroll]);

  const handleStartTracking = () => {
    if (!orderId.trim()) {
      toast({
        title: "Error",
        description: "Please enter an order ID",
        variant: "destructive",
      });
      return;
    }

    setCurrentOrderId(orderId);
    setIsTracking(true);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_order',
        orderId: orderId,
      }));
    }

    toast({
      title: "Tracking Started",
      description: `Now tracking order ${orderId}`,
    });
  };

  const handleStopTracking = () => {
    setIsTracking(false);
    setCurrentOrderId("");
    setMessages([]);
    
    toast({
      title: "Tracking Stopped",
      description: "Order tracking has been stopped",
    });
  };

  const handleClearMessages = async () => {
    if (!currentOrderId) return;
    
    try {
      await apiRequest('DELETE', `/api/orders/${currentOrderId}/messages`);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/orders', currentOrderId, 'messages'] });
      
      toast({
        title: "Messages Cleared",
        description: "All messages have been cleared",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear messages",
        variant: "destructive",
      });
    }
  };

  const handleRetryConnection = () => {
    setShowError(false);
    window.location.reload();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-neutral-500';
      case 'confirmed': return 'bg-blue-500';
      case 'processing': return 'bg-warning';
      case 'shipped': return 'bg-primary';
      case 'delivered': return 'bg-success';
      case 'cancelled': return 'bg-error';
      default: return 'bg-gray-300';
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'pending': return 20;
      case 'confirmed': return 40;
      case 'processing': return 60;
      case 'shipped': return 80;
      case 'delivered': return 100;
      default: return 0;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'info': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      default: return <div className="w-2 h-2 bg-green-500 rounded-full" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Cog className="w-4 h-4 text-white animate-spin" />;
      case 'delivered': return <CheckCircle className="w-4 h-4 text-white" />;
      case 'shipped': return <Truck className="w-4 h-4 text-white" />;
      default: return <Clock className="w-4 h-4 text-white" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Truck className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Order Status Monitor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-error'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected to Kafka' : 'Disconnected'}
                </span>
              </div>
              <Button variant="ghost" size="sm">
                <Cog className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Track Order</h2>
              
              {/* Quick start buttons */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">Quick Start - Try these sample orders:</p>
                <div className="flex flex-wrap gap-2">
                  {['ORD-2024-001', 'ORD-2024-002', 'ORD-2024-003'].map(id => (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      onClick={() => setOrderId(id)}
                      className="text-xs"
                    >
                      {id}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="order-id" className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID
                </label>
                <div className="relative">
                  <Input
                    id="order-id"
                    type="text"
                    placeholder="Try: ORD-2024-001, ORD-2024-002, or ORD-2024-003"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="pr-10"
                  />
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleStartTracking} 
                  disabled={!orderId.trim() || isTracking}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Tracking
                </Button>
                <Button 
                  onClick={handleStopTracking} 
                  disabled={!isTracking}
                  variant="secondary"
                  className="w-full"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Tracking
                </Button>
                
                {/* Test button for manual updates */}
                <Button 
                  onClick={async () => {
                    if (currentOrderId) {
                      try {
                        // Use relative URL to avoid CORS issues
                        const response = await fetch(`/api/orders/${currentOrderId}/trigger-update`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ status: 'shipped' }),
                        });
                        
                        if (response.ok) {
                          toast({
                            title: "Manual Update Triggered",
                            description: `Order ${currentOrderId} status update sent`,
                          });
                        } else {
                          toast({
                            title: "Update Failed",
                            description: "Failed to trigger manual update",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        console.error('Manual update error:', error);
                        toast({
                          title: "Update Failed",
                          description: "Failed to trigger manual update",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                  disabled={!currentOrderId}
                  variant="outline"
                  className="w-full"
                >
                  <Cog className="w-4 h-4 mr-2" />
                  Test Update
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Refresh Interval</label>
                    <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 second</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="auto-scroll"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="auto-scroll" className="text-sm text-gray-700">
                      Auto-scroll to latest
                    </label>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recent Orders */}
            <Card className="p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
              <div className="space-y-3">
                {recentOrders.map((order: Order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => setOrderId(order.orderId)}
                  >
                    <div>
                      <div className="font-medium text-sm">{order.orderId}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(order.status)}`} />
                      <span className="text-xs text-gray-600 capitalize">{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Order Status */}
            {currentOrder && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Current Order Status</h2>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-success animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-sm text-gray-600">
                        {isTracking ? 'Live' : 'Offline'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Last updated: {new Date(currentOrder.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Order Details Card */}
                <div className="bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{currentOrder.orderId}</h3>
                      <p className="text-blue-100 mt-1">Customer: {currentOrder.customerName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{currentOrder.totalAmount}</div>
                      <div className="text-blue-100">{currentOrder.itemCount} items</div>
                    </div>
                  </div>
                </div>

                {/* Status Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-700">Order Progress</span>
                    <span className="text-sm text-gray-500">
                      {getStatusProgress(currentOrder.status)}% Complete
                    </span>
                  </div>
                  <Progress value={getStatusProgress(currentOrder.status)} className="h-2" />
                </div>

                {/* Status Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((status, index) => {
                    const isActive = currentOrder.status === status;
                    const isCompleted = getStatusProgress(currentOrder.status) > getStatusProgress(status);
                    
                    return (
                      <div 
                        key={status}
                        className={`rounded-lg p-4 text-center ${
                          isActive ? 'bg-blue-50 border-2 border-primary' : 
                          isCompleted ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                          isActive ? 'bg-primary animate-pulse' :
                          isCompleted ? 'bg-success' : 'bg-gray-300'
                        }`} />
                        <div className="text-sm font-medium text-gray-900 capitalize">{status}</div>
                        <div className={`text-xs ${
                          isActive ? 'text-primary' :
                          isCompleted ? 'text-success' : 'text-gray-400'
                        }`}>
                          {isActive ? 'In Progress' : isCompleted ? 'Completed' : 'Pending'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Real-time Messages - Always Visible */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Real-time Messages</h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-600">
                    {isTracking ? 'Listening' : 'Stopped'}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearMessages}
                    disabled={!currentOrderId}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {orderMessages.length === 0 && !isTracking && (
                    <div className="text-center py-8 text-gray-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No messages yet. Start tracking an order to see real-time updates.</p>
                    </div>
                  )}
                  {orderMessages.length === 0 && isTracking && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-pulse">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-blue-300" />
                        <p className="text-sm">Listening for real-time updates...</p>
                      </div>
                    </div>
                  )}
                  {orderMessages.map((message: OrderMessage) => (
                    <div key={message.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      {getMessageIcon(message.messageType)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {message.messageType.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </Card>

            {/* Status History Timeline */}
            {statusHistory.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Status History</h3>
                
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  <div className="space-y-6">
                    {statusHistory.map((status: OrderStatusHistory, index) => (
                      <div key={status.id} className="relative flex items-start space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${getStatusColor(status.status)}`}>
                          {getStatusIcon(status.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">{status.title}</h4>
                            <span className="text-xs text-gray-500">
                              {new Date(status.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{status.description}</p>
                          <div className="mt-2 text-xs text-gray-500">
                            {status.duration && (
                              <span className="mr-4">Duration: {status.duration}</span>
                            )}
                            <span>Operator: {status.operator}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {showError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <AlertCircle className="text-red-500 text-xl mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Connection Error</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Unable to connect to Kafka message broker. Please check your connection and try again.
              </p>
              <div className="flex space-x-3">
                <Button onClick={handleRetryConnection}>
                  <Loader2 className="w-4 h-4 mr-2" />
                  Retry Connection
                </Button>
                <Button variant="secondary" onClick={() => setShowError(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Modal */}
      {showLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-8 text-center">
              <div className="mb-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connecting to Kafka</h3>
              <p className="text-gray-600">Establishing connection to message broker...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
