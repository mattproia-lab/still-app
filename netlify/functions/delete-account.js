const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function getUserFromToken(token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function supaDelete(path) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Delete failed ${path}: ${res.status} ${detail}`);
  }
  return res.ok;
}

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

  const token = body.access_token;
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
  }

  // Resolve the user from their token — never trust a client-sent id
  const user = await getUserFromToken(token);
  if (!user || !user.id) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
  }
  const uid = user.id;

  // Delete rows keyed by user_id
  const tables = [
    'bell_preferences',
    'journey_entries',
    'user_activity',
    'usage_tracking',
    'voice_wallet',
    'promo_redemptions'
  ];
  for (const t of tables) {
    await supaDelete(`/rest/v1/${t}?user_id=eq.${uid}`);
  }

  // profiles uses `id`
  await supaDelete(`/rest/v1/profiles?id=eq.${uid}`);

  // Finally, delete the auth user
  const authRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`
    }
  });

  if (!authRes.ok) {
    const detail = await authRes.text();
    console.error('Auth delete failed:', detail);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not delete account.' }) };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ success: true })
  };
};