const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { user_id, email, type } = body;
  if (!user_id || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id or email' }) };
  }

  const isReflectionPack = type === 'reflection_pack';
  const priceId = isReflectionPack 
    ? process.env.STRIPE_REFLECTION_PRICE_ID 
    : process.env.STRIPE_PRICE_ID;
  const mode = isReflectionPack ? 'payment' : 'subscription';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode,
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id, type: type || 'premium' },
      success_url: `${process.env.SITE_URL}?upgraded=true`,
      cancel_url: `${process.env.SITE_URL}?upgraded=false`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url })
    };

  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};