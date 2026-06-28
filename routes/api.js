const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  const shop = req.query.shop || 'nbtsd.myshopify.com';

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_domain', shop);

  const total = orders?.length || 0;
  const high = orders?.filter(o => o.risk_level === 'high').length || 0;
  const medium = orders?.filter(o => o.risk_level === 'medium').length || 0;
  const blocked = orders?.filter(o => o.is_blocked).length || 0;

  res.json({ total_orders: total, high_risk: high, medium_risk: medium, blocked });
});

// Orders list
router.get('/orders', async (req, res) => {
  const shop = req.query.shop || 'nbtsd.myshopify.com';
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_domain', shop)
    .order('created_at', { ascending: false });

  res.json(data || []);
});

module.exports = router;