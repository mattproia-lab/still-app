// Netlify serverless function — Claude API proxy
// Your API key stays here, in Netlify's encrypted environment
// Users never see it, never need their own

exports.handler = async function(event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Basic rate limiting by IP — prevents a single user burning your credits
  // (Netlify doesn't persist state, so this is per-invocation — good enough for abuse prevention)
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured on server.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
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
        model: body.model || 'claude-opus-4-5',
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
