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

// Get merchant settings
router.get('/settings', async (req, res) => {
  const shop = req.query.shop || 'nbtsd.myshopify.com';

  const { data, error } = await supabase
    .from('merchant_settings')
    .select('*')
    .eq('shop_domain', shop)
    .single();

  if (error) return res.status(404).json({ error: 'Settings not found' });
  res.json(data);
});

// Update merchant settings
router.post('/settings', async (req, res) => {
  const { shop, high_risk_threshold, medium_risk_threshold, auto_block, alert_email } = req.body;

  if (!shop) return res.status(400).json({ error: 'Shop is required' });

  const updateData = { updated_at: new Date().toISOString() };
  if (high_risk_threshold !== undefined) updateData.high_risk_threshold = high_risk_threshold;
  if (medium_risk_threshold !== undefined) updateData.medium_risk_threshold = medium_risk_threshold;
  if (auto_block !== undefined) updateData.auto_block = auto_block;
  if (alert_email !== undefined) updateData.alert_email = alert_email;

  const { data, error } = await supabase
    .from('merchant_settings')
    .update(updateData)
    .eq('shop_domain', shop)
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  res.json({ success: true, data });
});

// Get blocklist
router.get('/blocklist', async (req, res) => {
  const shop = req.query.shop || 'nbtsd.myshopify.com';

  const { data, error } = await supabase
    .from('blocklist')
    .select('*')
    .eq('shop_domain', shop)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Add to blocklist
router.post('/blocklist', async (req, res) => {
  const { shop, type, value, reason } = req.body;

  if (!shop || !type || !value) {
    return res.status(400).json({ error: 'shop, type, and value are required' });
  }

  const validTypes = ['email', 'domain', 'country', 'ip'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'type must be one of: email, domain, country, ip' });
  }

  const { data, error } = await supabase
    .from('blocklist')
    .insert([{
      shop_domain: shop,
      type,
      value: value.toLowerCase().trim(),
      reason: reason || null
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This item is already blocklisted' });
    }
    return res.status(500).json({ error });
  }
  res.json({ success: true, data });
});

// Remove from blocklist
router.delete('/blocklist/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('blocklist')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error });
  res.json({ success: true });
});

module.exports = router;