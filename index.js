require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');

app.use(express.json());

// CORS fix
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Veriqon backend is running!' });
});

// Auth callback - Shopify OAuth
app.get('/auth/callback', async (req, res) => {
  const { shop, code, hmac } = req.query;

  if (!shop || !code) {
    return res.status(400).send('Missing shop or code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).send('Could not get access token');
    }

    // Save to Supabase
    const supabase = require('./db/supabase');
    await supabase.from('merchant_settings').upsert({
      shop_domain: shop,
      access_token: accessToken,
      plan: 'free',
      installed_at: new Date().toISOString()
    });

    // Register webhooks
    await registerWebhooks(shop, accessToken);

    res.send('Veriqon installed successfully! You can close this tab.');

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).send('Installation failed');
  }
});

// Register webhooks function
async function registerWebhooks(shop, accessToken) {
  const webhooks = [
    { topic: 'orders/create', address: `${process.env.APP_URL}/webhook/orders/create` },
    { topic: 'orders/updated', address: `${process.env.APP_URL}/webhook/orders/updated` }
  ];

  for (const webhook of webhooks) {
    await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ webhook })
    });
  }
  console.log(`Webhooks registered for ${shop}`);
}

// Routes
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Veriqon server running on port ${PORT}`);
});
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);