const supabase = require('../db/supabase');

async function processOrder(order, shop) {
  const flags = [];
  let riskScore = 0;

  // Get merchant's custom thresholds
  const { data: merchant } = await supabase
    .from('merchant_settings')
    .select('high_risk_threshold, medium_risk_threshold, auto_block')
    .eq('shop_domain', shop)
    .single();

  const highThreshold = merchant?.high_risk_threshold ?? 70;
  const mediumThreshold = merchant?.medium_risk_threshold ?? 40;
  const autoBlockEnabled = merchant?.auto_block ?? true;

  // Check blocklist
  const { data: blocklist } = await supabase
    .from('blocklist')
    .select('type, value')
    .eq('shop_domain', shop);

  let blocklistMatch = null;
  if (blocklist && blocklist.length > 0) {
    const customerEmail = order.email?.toLowerCase().trim();
    const emailDomain = customerEmail?.split('@')[1];
    const ip = order.browser_ip;
    const country = order.shipping_address?.country;

    for (const item of blocklist) {
      if (item.type === 'email' && item.value === customerEmail) {
        blocklistMatch = `Blocklisted email: ${customerEmail}`;
        break;
      }
      if (item.type === 'domain' && item.value === emailDomain) {
        blocklistMatch = `Blocklisted email domain: ${emailDomain}`;
        break;
      }
      if (item.type === 'ip' && item.value === ip) {
        blocklistMatch = `Blocklisted IP: ${ip}`;
        break;
      }
      if (item.type === 'country' && country && item.value === country.toLowerCase()) {
        blocklistMatch = `Blocklisted country: ${country}`;
        break;
      }
    }
  }

  const billing = order.billing_address;
  const shipping = order.shipping_address;
  const billingEqShipping = billing?.city === shipping?.city &&
    billing?.country === shipping?.country;

  // Rule 1: Billing != Shipping
  if (!billingEqShipping && billing && shipping) {
    flags.push('billing_shipping_mismatch');
    riskScore += 20;
  }

  // Rule 2: High value order
  if (parseFloat(order.total_price) > 5000) {
    flags.push('high_value_order');
    riskScore += 20;
  }

  // Rule 3: New customer
  const isNewCustomer = !order.customer?.orders_count || order.customer.orders_count <= 1;
  if (isNewCustomer) {
    flags.push('new_customer');
    riskScore += 15;
  }

  // Rule 4: New customer + high value (combo risk)
  if (isNewCustomer && parseFloat(order.total_price) > 3000) {
    flags.push('new_customer_high_value');
    riskScore += 15;
  }

  // Rule 5: No phone number provided
  if (!order.customer?.phone && !shipping?.phone) {
    flags.push('no_phone_number');
    riskScore += 10;
  }

  // Rule 6: Disposable / suspicious email domains
  const suspiciousDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com'];
  const emailDomain = order.email?.split('@')[1]?.toLowerCase();
  if (emailDomain && suspiciousDomains.includes(emailDomain)) {
    flags.push('disposable_email');
    riskScore += 25;
  }

  // Rule 7: Multiple items, very high quantity (bulk/bot order)
  const totalQuantity = order.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  if (totalQuantity > 10) {
    flags.push('bulk_quantity_order');
    riskScore += 15;
  }

  // Rule 8: No billing address at all
  if (!billing) {
    flags.push('missing_billing_address');
    riskScore += 10;
  }

  // Rule 9: International order to high-risk country (example list)
  const highRiskCountries = ['Nigeria', 'Russia', 'North Korea'];
  if (shipping?.country && highRiskCountries.includes(shipping.country)) {
    flags.push('high_risk_country');
    riskScore += 20;
  }

  // Rule 10: COD with high value (common fraud pattern in India)
  if (order.financial_status === 'pending' && parseFloat(order.total_price) > 4000) {
    flags.push('high_value_cod');
    riskScore += 15;
  }

// Blocklist override — instant high risk + auto block
  if (blocklistMatch) {
    flags.push('blocklist_match');
    riskScore = 100;
  }

  // Cap score at 100
  if (riskScore > 100) riskScore = 100;

  let riskLevel = 'low';
  if (riskScore >= highThreshold) riskLevel = 'high';
  else if (riskScore >= mediumThreshold) riskLevel = 'medium';

 const isBlocked = (autoBlockEnabled && riskScore >= highThreshold) || !!blocklistMatch;

  const { data, error } = await supabase.from('orders').insert([{
    shopify_order_id: String(order.id),
    shop_domain: shop,
    order_number: String(order.order_number),
    total_price: parseFloat(order.total_price),
    customer_email: order.email,
    customer_id: String(order.customer?.id),
    is_new_customer: isNewCustomer,
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
    is_blocked: isBlocked,
  }]);

  if (error) console.error('Supabase insert error:', error);

  return { riskScore, riskLevel, flags, isBlocked };
}

module.exports = { processOrder };