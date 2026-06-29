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

// Customers list — orders se unique customers
router.get('/customers', async (req, res) => {
  const shop = req.query.shop || 'nbtsd.myshopify.com';

  const { data, error } = await supabase
    .from('orders')
    .select('customer_email, customer_id, is_new_customer, risk_level, risk_score, is_blocked, total_price, flags')
    .eq('shop_domain', shop)
    .order('risk_score', { ascending: false });

  if (error) return res.status(500).json({ error });

  // Unique customers by email
  const customerMap = {};
  data.forEach(order => {
    const email = order.customer_email || 'unknown';
    if (!customerMap[email]) {
      customerMap[email] = {
        email,
        total_orders: 0,
        total_spent: 0,
        risk_level: order.risk_level,
        risk_score: order.risk_score,
        is_blocked: order.is_blocked,
        is_new_customer: order.is_new_customer,
        flags: order.flags || []
      };
    }
    customerMap[email].total_orders += 1;
    customerMap[email].total_spent += Number(order.total_price) || 0;
    // Highest risk level rakho
    if (order.risk_score > customerMap[email].risk_score) {
      customerMap[email].risk_score = order.risk_score;
      customerMap[email].risk_level = order.risk_level;
    }
  });

  res.json(Object.values(customerMap));
});

// Single order detail
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const shop = req.query.shop || 'nbtsd.myshopify.com';

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('shop_domain', shop)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

// Block/Unblock order
router.post('/orders/:id/block', async (req, res) => {
  const { id } = req.params;
  
  const { data, error } = await supabase
    .from('orders')
    .update({ is_blocked: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  res.json({ success: true, data });
});

router.post('/orders/:id/unblock', async (req, res) => {
  const { id } = req.params;
  
  const { data, error } = await supabase
    .from('orders')
    .update({ is_blocked: false })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  res.json({ success: true, data });
});

module.exports = router;