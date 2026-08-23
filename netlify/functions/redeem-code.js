const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Same shape as claude.js:53 -- verify the caller's Supabase token and let the
// auth server tell us who they are. The client never supplies its own user_id.
async function getUserFromToken(token, serviceKey) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

const fail = (statusCode, error) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...CORS },
  body: JSON.stringify({ error })
});

// Errors the RPC can return, mapped to status codes.
const STATUS_FOR = {
  'Invalid code': 404,
  'Profile not found': 404,
  'Code has expired': 400,
  'Code has no uses remaining': 400,
  'Code already redeemed': 400
};

exports.handler = async (event) => {
  // CORS preflight from the native shell (origin capacitor://localhost)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
  }

  const { code, access_token } = JSON.parse(event.body || '{}');
  if (!code || !access_token) {
    return fail(400, 'Missing code or access_token');
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  const user = await getUserFromToken(access_token, serviceKey);
  if (!user || !user.id) {
    return fail(401, 'Not authenticated.');
  }

  // Everything -- validate, claim, decrement, grant -- happens in one
  // transaction inside redeem_promo_code(). See
  // supabase/migrations/2026-08-23b-redeem-promo-code-rpc.sql.
  // Arguments travel in the JSON body, so there is no query string to escape.
  let result;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/redeem_promo_code`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_code: String(code).toUpperCase(), p_user: user.id })
    });
    if (!res.ok) {
      console.error('redeem_promo_code failed:', res.status, await res.text());
      return fail(500, 'Could not redeem the code. Try again.');
    }
    result = await res.json();
  } catch (err) {
    console.error('redeem_promo_code threw:', err);
    return fail(500, 'Could not redeem the code. Try again.');
  }

  if (!result || result.ok !== true) {
    const error = (result && result.error) || 'Invalid code';
    return fail(STATUS_FOR[error] || 400, error);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify({
      success: true,
      type: result.type,
      description: result.description,
      trial_extended_until: result.trial_extended_until
    })
  };
};
