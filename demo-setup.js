// Demo setup script to populate sample data for the order monitor
const SERVER_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

const sampleOrders = [
  {
    orderId: 'ORD-2024-001',
    customerId: 'CUST-123',
    customerName: 'John Doe',
    status: 'pending',
    totalAmount: '89.99',
    itemCount: 3,
  },
  {
    orderId: 'ORD-2024-002', 
    customerId: 'CUST-456',
    customerName: 'Jane Smith',
    status: 'confirmed',
    totalAmount: '159.50',
    itemCount: 2,
  },
  {
    orderId: 'ORD-2024-003',
    customerId: 'CUST-789',
    customerName: 'Bob Johnson',
    status: 'processing',
    totalAmount: '45.00',
    itemCount: 1,
  },
];

async function createOrder(orderData) {
  try {
    const response = await fetch(`${SERVER_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Created order: ${result.orderId}`);
    return result;
  } catch (error) {
    console.error(`Error creating order ${orderData.orderId}:`, error);
  }
}

async function populateData() {
  for (const order of sampleOrders) {
    await createOrder(order);
  }
  console.log('Sample data populated successfully!');
}

populateData();
