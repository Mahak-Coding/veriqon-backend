const express = require('express');
const router = express.Router();

router.post('/orders/create', async (req, res) => {
  console.log('🎯 Webhook received: orders/create');
  console.log('Shop:', req.headers['x-shopify-shop-domain']);
  console.log('Order:', JSON.stringify(req.body?.id));

  const order = req.body;
  const shop = req.headers['x-shopify-shop-domain'] || 'nbtsd.myshopify.com';

  try {
    const { processOrder } = require('../rules/engine');
    const result = await processOrder(order, shop);
    console.log('✅ Order processed:', result);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/orders/updated', async (req, res) => {
  console.log('🎯 Webhook received: orders/updated');
  res.status(200).json({ success: true });
});

module.exports = router;