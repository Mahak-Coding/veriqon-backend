require('dotenv').config();

const SHOP = 'nbtsd.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

async function registerWebhooks() {
  const webhooks = [
    { topic: 'orders/create', address: `${process.env.APP_URL}/webhook/orders/create` },
    { topic: 'orders/updated', address: `${process.env.APP_URL}/webhook/orders/updated` }
  ];

  for (const webhook of webhooks) {
    const res = await fetch(`https://${SHOP}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      body: JSON.stringify({ webhook })
    });
    const data = await res.json();
    console.log('Webhook registered:', JSON.stringify(data));
  }
}

registerWebhooks();