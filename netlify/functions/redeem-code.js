const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { code, user_id } = JSON.parse(event.body || '{}');
  if (!code || !user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or user_id' }) };

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  // Check code exists and is valid
  const codeRes = await fetch(
    `${SUPA_URL}/rest/v1/promo_codes?code=eq.${code.toUpperCase()}&select=*`,
    { headers }
  );
  const codes = await codeRes.json();
  if (!codes.length) return { statusCode: 404, body: JSON.stringify({ error: 'Invalid code' }) };

  const promo = codes[0];

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Code has expired' }) };
  }

  // Check uses remaining
  if (promo.uses_remaining <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Code has no uses remaining' }) };
  }

  // Check if user already redeemed this code
  const redemptionRes = await fetch(
    `${SUPA_URL}/rest/v1/promo_redemptions?code=eq.${code.toUpperCase()}&user_id=eq.${user_id}&select=id`,
    { headers }
  );
  const existing = await redemptionRes.json();
  if (existing.length) return { statusCode: 400, body: JSON.stringify({ error: 'Code already redeemed' }) };

  // Record redemption
  await fetch(`${SUPA_URL}/rest/v1/promo_redemptions`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ code: code.toUpperCase(), user_id })
  });

  // Decrement uses_remaining
  await fetch(`${SUPA_URL}/rest/v1/promo_codes?code=eq.${code.toUpperCase()}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ uses_remaining: promo.uses_remaining - 1 })
  });

  // Return what the user gets
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      type: promo.type,
      ai_sessions: promo.ai_sessions,
      stories_days: promo.stories_days,
      description: promo.description
    })
  };
};