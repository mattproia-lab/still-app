// netlify/functions/revenuecat-webhook.js
// Receives RevenueCat events and writes to the SAME Supabase source of truth as Stripe.
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RC_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET; // set in RevenueCat + Netlify env

/* A Supabase profile id is a uuid. RevenueCat sends '$RCAnonymousID:...' when the
   buyer purchased before signing in -- a truthy string, so it used to pass the
   bare `if (!userId)` guard and become a PATCH against a non-uuid id that matched
   no row. Check the shape, not merely the presence. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Google Play sends 'productId:basePlanId'; the App Store sends the bare id. The
   client already strips the suffix everywhere it matches a product, and so must
   this -- an exact-equality gate on the raw value silently skips every Play
   subscription event. */
function normalizeProductId(raw) {
  return String(raw || '').split(':')[0];
}

async function updateProfile(userId, fields) {
  /* return=representation makes PostgREST answer with the rows it changed. A
     PATCH that matches nothing is a 204 success, so status alone cannot tell a
     write from a no-op -- the row count is what proves the profile moved. */
  const res = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
               'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(fields)
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('updateProfile FAILED', res.status, 'user:', userId, 'fields:', fields, 'body:', text);
    throw new Error(`profile PATCH ${res.status}`);
  }
  let rows = [];
  try { rows = JSON.parse(text); } catch (e) {}
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('updateProfile MATCHED NO ROW -- user:', userId, 'fields:', fields);
    throw new Error('profile PATCH matched no row');
  }
  console.log('updateProfile ok -- user:', userId, 'fields:', fields);
}

/* Which plan, from the product that was bought. The two live ids are
   'still_monthly' and 'still_yearly'; the test is broader than those so a
   renamed or added annual sku ('..._annual') is still read correctly.

   Returns null for a missing product id rather than assuming monthly -- same
   rule as the Stripe side: a guess must not be recorded as an observation. */
function planFromProductId(productId) {
  if (typeof productId !== 'string' || !productId) return null;
  return /annual|yearly/i.test(productId) ? 'annual' : 'monthly';
}

/* Kept deliberately narrow -- an unknown sku must not be able to flip an account
   to premium -- but wide enough for the '_annual' rename planFromProductId
   already anticipates. */
const SUB_PRODUCT_RE = /^still_(monthly|yearly|annual)$/i;

async function addVoiceCredit(userId, cents) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/add_voice_credit`, {
    method: 'POST',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: userId, p_cents: parseInt(cents, 10) || 0 })
  });
  console.log('addVoiceCredit status:', res.status);
  if (!res.ok) throw new Error(`add_voice_credit ${res.status}`);
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
  const userId = ev.app_user_id;                     // the Supabase user id, when Purchases.logIn ran before the buy
  const productId = normalizeProductId(ev.product_id);
  // Family pooling key: family-shared subs carry the ORIGINAL purchaser's
  // transaction id, so every member of one family shares this value.
  const groupId = ev.original_transaction_id || null;

  /* Every skip below answers 200: the condition is permanent, and a retry storm
     from RevenueCat would not fix any of them. The log line is the alert. */
  if (!userId) {
    console.log('No app_user_id on event; skipping', type);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }
  if (!UUID_RE.test(userId)) {
    console.error('UNLINKED PURCHASE -- app_user_id is not a Supabase uuid:', userId,
                  '| type:', type, '| product:', productId,
                  '| aliases:', JSON.stringify(ev.aliases || []),
                  '| original_app_user_id:', ev.original_app_user_id || null,
                  '-- entitlement is live in RevenueCat but no profile was updated.');
    return { statusCode: 200, body: JSON.stringify({ received: true, unlinked: true }) };
  }

  try {
    // 2) Audio credit consumable -> top up the wallet (same RPC as Stripe)
    if (productId === 'still_audio_credit') {
      await addVoiceCredit(userId, 1000);            // $10 of audio, matching web
    }
    // 3) Subscriptions -> mark premium (same column as Stripe) + stamp family group
    else if (SUB_PRODUCT_RE.test(productId)) {
      if (['INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','PRODUCT_CHANGE','TRANSFER'].includes(type)) {
        await updateProfile(userId, { subscription_status: 'premium', sub_group_id: groupId,
                                      subscription_plan: planFromProductId(productId) });
      } else if (['CANCELLATION','EXPIRATION'].includes(type)) {
        // The plan goes with the subscription, as on the Stripe side.
        await updateProfile(userId, { subscription_status: 'free', sub_group_id: null,
                                      subscription_plan: null });
      } else {
        console.log('Subscription event ignored -- type:', type, 'product:', productId);
      }
    }
    else {
      console.log('Unhandled product -- product:', productId, 'raw:', ev.product_id, 'type:', type);
    }
  } catch (e) {
    console.error('RevenueCat webhook error:', e);
    return { statusCode: 500, body: 'Error' };
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
