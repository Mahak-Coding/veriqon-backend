require('dotenv').config();

const SHOP = 'nbtsd.myshopify.com';
const APP_URL = 'https://veriqon-backend.onrender.com';

// Shopify Partner API se token lenge
const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;

async function registerWebhooks() {
  // Basic auth se Shopify Admin API call
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  
  const webhooks = [
    { topic: 'orders/create', address: `${APP_URL}/webhook/orders/create` },
    { topic: 'orders/updated', address: `${APP_URL}/webhook/orders/updated` }
  ];

  for (const webhook of webhooks) {
    try {
      const res = await fetch(`https://${SHOP}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({ webhook })
      });
      const data = await res.json();
      console.log('Result:', JSON.stringify(data));
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

registerWebhooks();