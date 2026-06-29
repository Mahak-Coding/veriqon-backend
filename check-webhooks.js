require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const SHOP = 'nbtsd.myshopify.com';
const APP_URL = process.env.APP_URL;

async function checkAndRegister() {
  const { data } = await supabase
    .from('merchant_settings')
    .select('access_token')
    .eq('shop_domain', SHOP)
    .single();

  console.log('Token:', data?.access_token);

  const webhooks = [
    { topic: 'orders/create', address: `${APP_URL}/webhook/orders/create` },
    { topic: 'orders/updated', address: `${APP_URL}/webhook/orders/updated` }
  ];

  for (const webhook of webhooks) {
    const res = await fetch(`https://${SHOP}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': data?.access_token
      },
      body: JSON.stringify({ webhook })
    });
    const result = await res.json();
    console.log('Webhook:', JSON.stringify(result));
  }
}

checkAndRegister();