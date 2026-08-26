// netlify/functions/revenuecat-webhook.js
// Receives RevenueCat events and writes to the SAME Supabase source of truth as Stripe.
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RC_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET; // set in RevenueCat + Netlify env
async function updateProfile(userId, fields) {
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
}
/* Which plan, from the product that was bought. The two live ids are
   'still_monthly' and 'still_yearly'; the test is broader than those so a
   renamed or added annual sku ('..._annual') is still read correctly.

   Returns null for a missing product id rather than assuming monthly -- same
   rule as the Stripe side: a guess must not be recorded as an observation. */
function planFromProductId(productId) {
  if (typeof productId !== 'string') return null;
  return /annual|yearly/i.test(productId) ? 'annual' : 'monthly';
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
  // Family pooling key: family-shared subs carry the ORIGINAL purchaser's
  // transaction id, so every member of one family shares this value.
  const groupId = ev.original_transaction_id || null;
  if (!userId) {
    console.log('No app_user_id on event; skipping', type);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }
  try {
    // 2) Audio credit consumable -> top up the wallet (same RPC as Stripe)
    if (productId === 'still_audio_credit') {
      await addVoiceCredit(userId, 1000);            // $10 of audio, matching web
    }
    // 3) Subscriptions -> mark premium (same column as Stripe) + stamp family group
    else if (productId === 'still_monthly' || productId === 'still_yearly') {
      if (['INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','PRODUCT_CHANGE','TRANSFER'].includes(type)) {
        await updateProfile(userId, { subscription_status: 'premium', sub_group_id: groupId,
                                      subscription_plan: planFromProductId(productId) });
      } else if (['CANCELLATION','EXPIRATION'].includes(type)) {
        // The plan goes with the subscription, as on the Stripe side.
        await updateProfile(userId, { subscription_status: 'free', sub_group_id: null,
                                      subscription_plan: null });
      }
    }
  } catch (e) {
    console.error('RevenueCat webhook error:', e);
    return { statusCode: 500, body: 'Error' };
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};