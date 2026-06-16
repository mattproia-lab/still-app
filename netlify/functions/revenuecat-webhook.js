// netlify/functions/revenuecat-webhook.js
// Receives RevenueCat events and writes to the SAME Supabase source of truth as Stripe.

const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RC_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET; // set in RevenueCat + Netlify env

async function updateProfile(userId, status) {
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_status: status })
  });
}

async function addVoiceCredit(userId, cents) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/add_voice_credit`, {
    method: 'POST',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: userId, p_cents: parseInt(cents, 10) || 0 })
  });
  console.log('addVoiceCredit status:', res.status);
}

exports.handler = async function(event) {
  // 1) Verify the request actually came from RevenueCat
  const auth = event.headers['authorization'] || event.headers['Authorization'];
  if (RC_WEBHOOK_SECRET && auth !== `Bearer ${RC_WEBHOOK_SECRET}`) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const ev = body.event || {};
  const type = ev.type;                              // e.g. INITIAL_PURCHASE, RENEWAL, CANCELLATION, NON_RENEWING_PURCHASE
  const userId = ev.app_user_id;                     // this is the Supabase user id we set via Purchases.logIn
  const productId = ev.product_id;                   // e.g. 'still_audio_credit', 'still_monthly', 'still_yearly'

  if (!userId) {
    console.log('No app_user_id on event; skipping', type);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  try {
    // 2) Audio credit consumable → top up the wallet (same RPC as Stripe)
    if (productId === 'still_audio_credit') {
      await addVoiceCredit(userId, 1000);            // $10 of audio, matching web
    }
    // 3) Subscriptions → mark premium (same column as Stripe)
    else if (productId === 'still_monthly' || productId === 'still_yearly') {
      if (['INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','PRODUCT_CHANGE'].includes(type)) {
        await updateProfile(userId, 'premium');
      } else if (['CANCELLATION','EXPIRATION'].includes(type)) {
        await updateProfile(userId, 'free');
      }
    }
  } catch (e) {
    console.error('RevenueCat webhook error:', e);
    return { statusCode: 500, body: 'Error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};