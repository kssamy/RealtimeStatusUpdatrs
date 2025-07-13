import WebSocket from 'ws';

// Test WebSocket connection
const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', function open() {
  console.log('✓ WebSocket connection successful');
  
  // Test subscribing to an order
  ws.send(JSON.stringify({
    type: 'subscribe_order',
    orderId: 'ORD-2024-001'
  }));
});

ws.on('message', function message(data) {
  const parsedData = JSON.parse(data);
  console.log('📨 Received message:', parsedData);
  
  if (parsedData.type === 'connection_status') {
    console.log('🔌 Kafka connection status:', parsedData.connected);
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Keep the connection alive for 15 seconds to see updates
setTimeout(() => {
  ws.close();
}, 15000);