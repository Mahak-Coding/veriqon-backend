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

// Auth callback - Shopify OAuth (works for ANY store now)
app.get('/auth/callback', async (req, res) => {
  const { shop, code, hmac } = req.query;
  console.log('Auth callback received for shop:', shop);

  if (!shop || !code) {
    return res.status(400).send('Missing shop or code');
  }

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      })
    });

    const rawText = await tokenResponse.text();

    let tokenData;
    try {
      tokenData = JSON.parse(rawText);
    } catch (e) {
      console.error('Token parse error:', rawText);
      return res.status(400).send('Invalid token response from Shopify');
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).send('Could not get access token');
    }

    // Save THIS store's token — using shop as unique key
    const supabase = require('./db/supabase');
    const { error: upsertError } = await supabase
      .from('merchant_settings')
      .upsert({
        shop_domain: shop,
        access_token: accessToken,
        plan: 'free',
        auto_block: true,
        high_risk_threshold: 70,
        medium_risk_threshold: 40,
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'shop_domain' });

    if (upsertError) {
      console.error('Error saving merchant:', upsertError);
      return res.status(500).send('Failed to save store settings');
    }

    // Register webhooks for THIS specific store
    await registerWebhooks(shop, accessToken);

    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>✅ Veriqon installed successfully!</h2>
          <p>Fraud detection is now active for ${shop}</p>
          <p>You can close this tab.</p>
        </body>
      </html>
    `);

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).send('Installation failed');
  }
});

// Registers webhooks for the SPECIFIC store that installed the app
async function registerWebhooks(shop, accessToken) {
  const webhooks = [
    { topic: 'orders/create', address: `${process.env.APP_URL}/webhook/orders/create` },
    { topic: 'orders/updated', address: `${process.env.APP_URL}/webhook/orders/updated` }
  ];

  for (const webhook of webhooks) {
    try {
      const res = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({ webhook })
      });
      const data = await res.json();
      if (data.errors) {
        console.error(`Webhook registration error for ${shop}:`, data.errors);
      } else {
        console.log(`Webhook registered for ${shop}: ${webhook.topic}`);
      }
    } catch (err) {
      console.error(`Webhook registration failed for ${shop}:`, err.message);
    }
  }
}

// Routes
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Veriqon server running on port ${PORT}`);
});