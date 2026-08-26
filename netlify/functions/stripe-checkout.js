const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async function(event) {
  // CORS preflight from the native shell (origin capacitor://localhost)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { user_id, email, tier } = body;
  if (!user_id || !email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing user_id or email' }) };
  }

  // `plan` rides along in metadata because this is where the plan is actually
  // known -- the branch below picks it. The webhook then reads it back rather
  // than reconstructing it from the amount, which a coupon would distort.
  let priceId, mode = 'subscription', metadata = { user_id, tier: 'premium', plan: 'monthly' };
  let successUrl = `${process.env.SITE_URL}?upgraded=true`;

  if (tier === 'audio_credit') {
    priceId = process.env.STRIPE_AUDIO_CREDIT_PRICE_ID;
    mode = 'payment';
    metadata = { user_id, type: 'audio_topup', credit_cents: '1000' };
    successUrl = `${process.env.SITE_URL}?credit=added`;
  } else if (tier === 'annual') {
    priceId = process.env.STRIPE_ANNUAL_PRICE_ID;     // $89.99 / year
    metadata.plan = 'annual';
  } else {
    priceId = process.env.STRIPE_PRICE_ID;            // $9.99 / month
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode,
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      success_url: successUrl,
      cancel_url: `${process.env.SITE_URL}?upgraded=false`,
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify({ url: session.url })
    };
  } catch(err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};