const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const KNOWN = ['companion', 'deeper', 'sophia', 'chamber', 'paths', 'community', 'lectio', 'autobiography'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const LIMITS = {
  free:    { companion: 1, deeper: 0,  sophia: 0,  chamber: 3,  paths: 2,  community: 30,  lectio: 3,  autobiography: 1 },
  premium: { companion: 3, deeper: 14, sophia: 14, chamber: 30, paths: 20, community: 30, lectio: 12, autobiography: 1 }
};

// Family pooling: these features share ONE pool across all accounts in a
// sub_group. Values REPLACE the premium limit when the user is in a group.
const FAMILY_POOLED = { companion: 6, sophia: 4, deeper: 3 };

async function supaGet(path) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`
    }
  });
  return res.json();
}
// Free users get a one-time allowance of Amma and Deeper across the whole
// trial so they can experience both voices before deciding. Unlike LIMITS,
// these are counted for the lifetime of the account, not reset daily.
const TRIAL_TOTAL = { sophia: 4, deeper: 4 };
async function supaPost(path, body) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${res.status}: ${detail}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

// All user ids sharing this family group (includes the caller).
async function getGroupUserIds(groupId) {
  const data = await supaGet(`/rest/v1/profiles?sub_group_id=eq.${encodeURIComponent(groupId)}&select=id`);
  return Array.isArray(data) ? data.map(r => r.id) : [];
}

function sinceFor(feature) {
  const now = new Date();
  if (feature === 'companion') {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0,0,0,0);
    return monday.toISOString();
  }
  const today = new Date(now);
  today.setHours(0,0,0,0);
  return today.toISOString();
}

// Count usage for one user OR a whole family group.
// lifetime = true ignores the daily/weekly window and counts every row.
async function getUsageCount(userIds, feature, lifetime) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const filter = ids.length === 1
    ? `user_id=eq.${ids[0]}`
    : `user_id=in.(${ids.join(',')})`;
  const window = lifetime ? '' : `&used_at=gte.${sinceFor(feature)}`;
  const data = await supaGet(
    `/rest/v1/usage_tracking?${filter}&feature=eq.${feature}${window}&select=id`
  );
  return Array.isArray(data) ? data.length : 0;
}

async function logUsage(userId, feature) {
  await supaPost('/rest/v1/usage_tracking', {
    user_id: userId,
    feature: feature
  });
}

async function useCredit(userId, currentCredits) {
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reflection_credits: currentCredits - 1 })
  });
}

exports.handler = async function(event) {
  // CORS preflight from the native shell (origin capacitor://localhost)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const feature = body.feature;
  const token = body.access_token;

  if (!KNOWN.includes(feature) || !token) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Not authenticated.' }) };
  }

  const user = await getUserFromToken(token);
  if (!user || !user.id) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Not authenticated.' }) };
  }

  const profile = await getProfile(user.id);
  const status = profile?.subscription_status || 'free';
  const limits = LIMITS[status] || LIMITS.free;
  const credits = profile?.reflection_credits || 0;

// Family pooling: premium users in a sub_group share one pool for
  // pooled features; everything else behaves exactly as before.
  const groupId = (status === 'premium' && profile?.sub_group_id) ? profile.sub_group_id : null;
  const pooled = groupId && (feature in FAMILY_POOLED);

  // Free users draw on a lifetime trial allowance for Amma and Deeper,
  // which overrides the daily zero in LIMITS.free.
  const trialAllowance = (status !== 'premium' && feature in TRIAL_TOTAL);

  const limit = pooled         ? FAMILY_POOLED[feature]
              : trialAllowance ? TRIAL_TOTAL[feature]
              : (limits[feature] ?? 0);

  const onboardingFree = body.onboarding_free === true && feature === 'sophia';

  if (!onboardingFree) {
    if (limit === 0 && credits <= 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'upgrade_required' }) };
    }

    const countIds = pooled ? await getGroupUserIds(groupId) : [user.id];
    const count = await getUsageCount(countIds.length ? countIds : [user.id], feature, trialAllowance);

    if (count >= limit && credits <= 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'limit_reached' }) };
    }

    if (count >= limit && credits > 0) {
      await useCredit(user.id, credits);
    } else {
      await logUsage(user.id, feature);
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-6',
        max_tokens: body.max_tokens || 1024,
        system: body.system || '',
        messages: body.messages || [],
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify(data)
    };

  } catch(err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Upstream error: ' + err.message })
    };
  }
};