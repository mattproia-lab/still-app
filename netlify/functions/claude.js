const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const LIMITS = {
  free:    { companion: 0, deeper: 0, sophia: 0 },
  premium: { companion: 3, deeper: 14, sophia: 14 } // per week for companion, per day x7 for deeper/sophia
};

async function supaGet(path) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`
    }
  });
  return res.json();
}

async function supaPost(path, body) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

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

async function getProfile(userId) {
  const data = await supaGet(`/rest/v1/profiles?id=eq.${userId}&select=*`);
  return data?.[0] || null;
}

async function getUsageCount(userId, feature) {
  const now = new Date();
  let since;
  if (feature === 'companion') {
    // weekly — start of current week (Monday)
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0,0,0,0);
    since = monday.toISOString();
  } else {
    // daily
    const today = new Date(now);
    today.setHours(0,0,0,0);
    since = today.toISOString();
  }
  const data = await supaGet(
    `/rest/v1/usage_tracking?user_id=eq.${userId}&feature=eq.${feature}&used_at=gte.${since}&select=id`
  );
  return Array.isArray(data) ? data.length : 0;
}

async function logUsage(userId, feature) {
  await supaPost('/rest/v1/usage_tracking', {
    user_id: userId,
    feature: feature
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const feature = body.feature; // 'companion', 'deeper', 'sophia'
  const token = body.access_token;

  // If feature requires auth, enforce limits
  if (feature && token) {
    const user = await getUserFromToken(token);
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
    }

    const profile = await getProfile(user.id);
    const status = profile?.subscription_status || 'free';
    const limits = LIMITS[status] || LIMITS.free;
    const limit = limits[feature] ?? 0;

    if (limit === 0) {
      return { statusCode: 403, body: JSON.stringify({ error: 'upgrade_required' }) };
    }

    const count = await getUsageCount(user.id, feature);
    if (count >= limit) {
      return { statusCode: 403, body: JSON.stringify({ error: 'limit_reached' }) };
    }

    // Log usage before calling Claude
    await logUsage(user.id, feature);
  }

  // Forward to Anthropic
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 1024,
        system: body.system || '',
        messages: body.messages || [],
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data)
    };

  } catch(err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Upstream error: ' + err.message })
    };
  }
};