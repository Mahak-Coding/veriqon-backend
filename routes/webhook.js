const express = require('express');
const router = express.Router();
const crypto = require('crypto');

function verifyWebhook(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return hmac === hash;
}

router.post('/orders/create', async (req, res) => {
  if (!verifyWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const order = req.body;
  const shop = req.headers['x-shopify-shop-domain'];

  try {
    const { processOrder } = require('../rules/engine');
    const result = await processOrder(order, shop);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;