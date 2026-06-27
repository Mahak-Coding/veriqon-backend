const supabase = require('../db/supabase');

async function processOrder(order, shop) {
  const flags = [];
  let riskScore = 0;

  // Rule 1: Billing != Shipping address
  const billing = order.billing_address;
  const shipping = order.shipping_address;
  const billingEqShipping = billing?.city === shipping?.city &&
    billing?.country === shipping?.country;

  if (!billingEqShipping) {
    flags.push('billing_shipping_mismatch');
    riskScore += 20;
  }

  // Rule 2: High value order
  if (parseFloat(order.total_price) > 5000) {
    flags.push('high_value_order');
    riskScore += 20;
  }

  // Rule 3: New customer + high value
  if (!order.customer?.orders_count || order.customer.orders_count <= 1) {
    flags.push('new_customer');
    riskScore += 15;
  }

  // Risk level decide karo
  let riskLevel = 'low';
  if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'medium';

  // Supabase mein save karo
  const { data, error } = await supabase.from('orders').insert([{
    shopify_order_id: String(order.id),
    shop_domain: shop,
    order_number: String(order.order_number),
    total_price: parseFloat(order.total_price),
    customer_email: order.email,
    customer_id: String(order.customer?.id),
    is_new_customer: order.customer?.orders_count <= 1,
    billing_city: billing?.city,
    billing_country: billing?.country,
    shipping_city: shipping?.city,
    shipping_country: shipping?.country,
    billing_eq_shipping: billingEqShipping,
    browser_ip: order.browser_ip,
    risk_score: riskScore,
    risk_level: riskLevel,
    flags: flags,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    created_at_shopify: order.created_at,
  }]);

  if (error) console.error('Supabase insert error:', error);

  return { riskScore, riskLevel, flags };
}

module.exports = { processOrder };