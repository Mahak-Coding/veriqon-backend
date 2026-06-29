const express = require('express');
const router = express.Router();

router.post('/orders/create', async (req, res) => {
  console.log('🎯 Webhook received: orders/create');
  
  const order = req.body;
  // Always use nbtsd store
  const shop = 'nbtsd.myshopify.com';

  try {
    // Duplicate check
    const supabase = require('../db/supabase');
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', String(order.id))
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
  console.log('🎯 Webhook received: orders/updated');
  res.status(200).json({ success: true });
});

module.exports = router;