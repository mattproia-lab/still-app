// netlify/functions/create-promo-code.js
// Self-serve referral code creation for premium members.
//
// Every identity field on the created row comes from the caller's verified JWT
// and their profile row. NOTHING that identifies the rep is read from the
// request body -- if it were, any signed-in member could mint codes attributed
// to somebody else and redirect their commission.
//
// promo_codes is RLS-enabled with no policies, so the service key is the only
// way to write it. That makes this function the entire access-control surface,
// which is why the premium check lives here and not only in the page.

const SUPA_URL = process.env.SUPABASE_URL || 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

/* Must match the dropdown in partners.html. Anything else is rejected rather
   than stored: channel is what the commission report groups by, and a typo'd
   value would quietly create a category of one. */
const CHANNELS = ['parish', 'social', 'retreat', 'personal', 'other'];

const CODE_RE = /^[A-Z0-9]{3,20}$/;
const DESCRIPTION_MAX = 200;

/* Generous rather than meaningful. uses_remaining predates the referral cap and
   counts redemptions ever; max_referrals is the real limit and 10000 is
   effectively uncapped. Both are deliberate: a self-serve code should not stop
   working because a counter ran out, and if a rep ever needs a real ceiling it
   is set by hand in the dashboard. */
const USES_REMAINING = 9999;
const MAX_REFERRALS  = 10000;

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...CORS },
  body: JSON.stringify(payload)
});

async function getUserFromToken(token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function supa(path, opts) {
  const o = opts || {};
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: o.method || 'GET',
    headers: Object.assign({
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }, o.headers || {}),
    body: o.body
  });
}

/* Resolve the caller and prove they are premium.
   Returns { error } to be returned verbatim, or { user, email, name }. */
async function authorise(event) {
  const header = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { error: json(401, { error: 'Not authenticated.' }) };

  const user = await getUserFromToken(token);
  if (!user || !user.id || !user.email) return { error: json(401, { error: 'Not authenticated.' }) };

  // Only subscription_status is selected. Selecting a column that does not
  // exist fails the WHOLE query -- the scar refreshSubscription() carries from
  // trial_extended_until -- and this one gates code creation, so it stays
  // narrow and certain.
  const res = await supa(`profiles?id=eq.${user.id}&select=subscription_status`);
  if (!res.ok) return { error: json(500, { error: 'Could not read your account.' }) };
  const rows = await res.json();
  if (!rows || !rows[0] || rows[0].subscription_status !== 'premium') {
    return { error: json(403, { error: 'Still Partners is available to active Still members.' }) };
  }

  /* The name is best-effort and may be null.

     There is NO name column on profiles and nothing writes one: submitAuth()
     in index.html posts only { email, password } to /auth/v1/signup, and no
     query anywhere in the repo selects a name. user_metadata is read because
     it costs nothing and would carry a name if one is ever collected at
     signup -- today it is empty, so rep_name is written null rather than
     invented from the email. The portal renders a missing rep_name as an
     em dash. */
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || null;

  return { user, email: user.email.trim().toLowerCase(), name };
}

async function isTaken(code) {
  const res = await supa(`promo_codes?code=eq.${encodeURIComponent(code)}&select=code`);
  if (!res.ok) throw new Error('lookup failed: ' + res.status);
  const rows = await res.json();
  return rows.length > 0;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // Availability checking is behind the same gate as creation. Left open it
  // would be a free oracle for enumerating live promo codes one guess at a
  // time, which is exactly what a promo code has to stay secret about.
  const auth = await authorise(event);
  if (auth.error) return auth.error;

  try {
    // -- GET: is this code free? --
    if (event.httpMethod === 'GET') {
      const raw = ((event.queryStringParameters || {}).code || '').trim().toUpperCase();
      if (!CODE_RE.test(raw)) {
        return json(200, { code: raw, valid: false, available: false,
                           error: 'Codes are 3 to 20 letters and numbers.' });
      }
      return json(200, { code: raw, valid: true, available: !(await isTaken(raw)) });
    }

    // -- POST: create it --
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch (e) { return json(400, { error: 'Invalid JSON.' }); }

    const code = String(body.code || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      return json(400, { error: 'Codes are 3 to 20 letters and numbers, no spaces or symbols.' });
    }

    const channel = String(body.channel || '').trim().toLowerCase();
    if (CHANNELS.indexOf(channel) < 0) {
      return json(400, { error: 'Choose a channel from the list.' });
    }

    let description = String(body.description == null ? '' : body.description).trim();
    if (description.length > DESCRIPTION_MAX) {
      return json(400, { error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` });
    }
    if (!description) description = null;

    if (await isTaken(code)) {
      return json(409, { error: 'That code is already taken.' });
    }

    // type is deliberately NOT set: the column already exists, defaults to
    // 'parish', and means the code's CATEGORY, which is a different axis from
    // channel. redeem_promo_code() returns it to the client on redemption, so
    // writing channel into it would change what an existing consumer sees.
    const res = await supa('promo_codes', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        code: code,
        channel: channel,
        description: description,
        uses_remaining: USES_REMAINING,
        max_referrals: MAX_REFERRALS,
        rep_name: auth.name,        // from the token, never the body
        rep_email: auth.email       // lowercased -- referral-report.js filters with eq.
      })
    });

    // isTaken() above is a read-then-write and cannot be atomic. If code
    // carries a unique constraint, a race lands here instead, and the database
    // is the authority -- 23505 is unique_violation.
    if (res.status === 409) {
      return json(409, { error: 'That code is already taken.' });
    }
    if (!res.ok) {
      const detail = await res.text();
      if (detail.indexOf('23505') >= 0 || detail.indexOf('duplicate key') >= 0) {
        return json(409, { error: 'That code is already taken.' });
      }
      console.error('create-promo-code insert:', res.status, detail);
      return json(500, { error: 'The code could not be created.' });
    }

    const created = (await res.json())[0] || null;
    return json(201, { created: created });
  } catch (e) {
    console.error('create-promo-code:', e.message);
    return json(500, { error: 'The code could not be created.' });
  }
};
