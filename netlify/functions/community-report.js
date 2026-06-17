const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const HIDE_THRESHOLD = 2;

function headers() {
  return {
    'apikey': SUPA_SERVICE_KEY,
    'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) }; }

  const { response_id, device_id } = body;
  if (!response_id || !device_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing_fields' }) };
  }

  // 1. Record the report. Unique constraint blocks duplicates from same device.
  const insertRes = await fetch(`${SUPA_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ response_id, device_id })
  });

  if (insertRes.status === 409) {
    // already reported by this device — treat as success, no double count
    return { statusCode: 200, body: JSON.stringify({ ok: true, already: true }) };
  }
  if (!insertRes.ok) {
    const detail = await insertRes.text();
    return { statusCode: 502, body: JSON.stringify({ error: 'report_failed', detail }) };
  }

  // 2. Recount reports for this response (source of truth = the reports table)
  const countRes = await fetch(
    `${SUPA_URL}/rest/v1/reports?response_id=eq.${response_id}&select=id`,
    { headers: headers() }
  );
  const rows = countRes.ok ? await countRes.json() : [];
  const count = Array.isArray(rows) ? rows.length : 0;

  // 3. Update the response: store count, and hide if threshold reached
  const hidden = count >= HIDE_THRESHOLD;
  await fetch(`${SUPA_URL}/rest/v1/responses?id=eq.${response_id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ report_count: count, hidden })
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, count, hidden }) };
};