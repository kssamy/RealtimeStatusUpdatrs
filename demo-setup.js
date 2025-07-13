// Demo setup script to populate the system with sample data
const sampleOrders = [
  {
    orderId: "ORD-2024-001",
    customerId: "CUST-123",
    customerName: "John Smith",
    totalAmount: "$125.50",
    itemCount: 3,
    status: "processing"
  },
  {
    orderId: "ORD-2024-002", 
    customerId: "CUST-456",
    customerName: "Sarah Johnson",
    totalAmount: "$89.99",
    itemCount: 2,
    status: "shipped"
  },
  {
    orderId: "ORD-2024-003",
    customerId: "CUST-789",
    customerName: "Mike Wilson",
    totalAmount: "$199.99",
    itemCount: 1,
    status: "delivered"
  }
];

// Function to populate sample data
async function populateSampleData() {
  const baseUrl = 'http://localhost:5000';
  
  for (const order of sampleOrders) {
    try {
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });
      
      if (response.ok) {
        console.log(`Created order: ${order.orderId}`);
      }
    } catch (error) {
      console.error(`Error creating order ${order.orderId}:`, error);
    }
  }
}

// Run the demo setup
populateSampleData().then(() => {
  console.log('Sample data populated successfully!');
}).catch(error => {
  console.error('Error populating sample data:', error);
});