const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function updateProfile(userId, status) {
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subscription_status: status })
  });
}

exports.handler = async function(event) {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch(err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const session = stripeEvent.data.object;

  if (stripeEvent.type === 'checkout.session.completed') {
    const userId = session.metadata?.user_id;
    if (userId) await updateProfile(userId, 'premium');
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const userId = session.metadata?.user_id;
    if (userId) await updateProfile(userId, 'free');
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};