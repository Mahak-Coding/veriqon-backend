const express = require('express');
const router = express.Router();

router.post('/orders/create', async (req, res) => {
  const order = req.body;
  const shop = req.headers['x-shopify-shop-domain'];

  console.log(`🎯 Webhook received: orders/create from ${shop}`);

  if (!shop) {
    console.error('No shop domain in webhook headers');
    return res.status(400).json({ error: 'Missing shop domain' });
  }

  try {
    const supabase = require('../db/supabase');

    // Duplicate check
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', String(order.id))
      .eq('shop_domain', shop)
      .single();

    if (existing) {
      console.log('Duplicate order — skipping');
      return res.status(200).json({ success: true, message: 'duplicate' });
    }

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
  const shop = req.headers['x-shopify-shop-domain'];
  console.log(`🎯 Webhook received: orders/updated from ${shop}`);
  res.status(200).json({ success: true });
});

module.exports = router;