const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/* Annual is $89.99, monthly $9.99. Anything at or above $80.00 is the annual
   plan; nothing else Stripe charges here comes close to it. */
const ANNUAL_CENTS_MIN = 8000;

/* Which plan was bought.

   metadata.plan first: stripe-checkout.js sets it on the branch that chooses
   the price, so it is the plan we deliberately selected rather than one
   inferred afterwards. It is also the access pattern this handler already
   relies on for user_id and type.

   amount_total second, for any session created before that shipped or from
   somewhere else. It is what the customer was actually charged, so a coupon
   can drag an annual below the threshold -- which is why it is the fallback
   and not the source.

   null last. The commission view treats a null plan as monthly, but it does so
   as a documented fallback; writing 'monthly' here would record a guess as
   though it had been observed. */
function planFromAmount(amountTotal) {
  if (typeof amountTotal !== 'number') return null;
  return amountTotal >= ANNUAL_CENTS_MIN ? 'annual' : 'monthly';
}

function planFromSession(session) {
  const declared = session.metadata?.plan;
  if (declared === 'monthly' || declared === 'annual') return declared;
  return planFromAmount(session.amount_total);
}

/* `plan` is optional and three-valued on purpose:
     'monthly' | 'annual'  record it
     null                  clear it -- there is no active plan any more
     undefined             leave the column alone
   JSON.stringify drops undefined keys, so an omitted plan never reaches the
   PATCH body and PostgREST never touches the column. */
async function updateProfile(userId, status, plan) {
  const body = { subscription_status: status };
  if (plan !== undefined) body.subscription_plan = plan;
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function addReflections(userId, amount) {
  const res = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=reflection_credits`, {
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}` }
  });
  const data = await res.json();
  const current = data?.[0]?.reflection_credits || 0;
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflection_credits: current + amount })
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
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const session = stripeEvent.data.object;

  if (stripeEvent.type === 'checkout.session.completed') {
    const userId = session.metadata?.user_id;
    const type = session.metadata?.type;
    if (userId && type === 'reflection_pack') {
      await addReflections(userId, 10);
    } else if (userId && type === 'audio_topup') {
      await addVoiceCredit(userId, session.metadata?.credit_cents || 0);
    } else if (userId) {
      await updateProfile(userId, 'premium', planFromSession(session));
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const userId = session.metadata?.user_id;
    // The plan goes with the subscription. `session` here is a Subscription
    // object, not a Checkout Session, and carries no amount_total to read.
    if (userId) await updateProfile(userId, 'free', null);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};