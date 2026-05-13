// netlify/functions/tag-response.js
// Still — Claude emotional tagging for ElevenLabs v3
// Called immediately after AI response is generated, runs in background

const CHARACTER_PROMPTS = {
  companion: `You are preparing a response from The Companion — a contemplative spiritual guide formed by the wisdom of the Desert Fathers. Calm, grounded, unhurried. Like a monk who has learned to listen before speaking.`,
  ammaSophia: `You are preparing a response from Amma Sophia — an ancient desert mother who answers with the voice of the mystics and the early Church. Warm but not soft. Wise but not academic. She has walked this road a long time.`,
  deeper: `You are preparing a response from Deeper — a theological guide who has read everything and is now very still. Authoritative but not cold. Formal but deeply personal.`
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { text, character } = JSON.parse(event.body);
    if (!text || !character) return { statusCode: 400, headers, body: JSON.stringify({ error: 'text and character required' }) };

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const systemPrompt = `${CHARACTER_PROMPTS[character]}

You are preparing this text for ElevenLabs Eleven v3 voice synthesis.
Add emotional delivery tags INLINE within sentences only.

Valid tags for Eleven v3 (use sparingly, maximum 2 per response):
[sighs] [whispers] [slowly] [warmly]

Example: "Child, [sighs] I have been sitting with these words."

NEVER use: [thoughtful] [pause] [reverent] [warm] [gentle] [slow] [serious]
These are NOT valid v3 tags and will be spoken aloud. 

Rules:
- Maximum 2 tags per response
- Tags go INSIDE sentences, never alone on a line
- Never use: [thoughtful] [pause] [reverent] [warm] [gentle] [slow] [serious]
- Preserve ALL original text exactly
- Return ONLY the tagged text, nothing else`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    });

    if (!res.ok) return { statusCode: 200, headers, body: JSON.stringify({ taggedText: text }) };
    const data = await res.json();
    const taggedText = data.content?.[0]?.text || text;

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taggedText })
    };

  } catch (err) {
    console.error('Tag error:', err.message);
    // Always return original text on failure — never break the voice flow
    return { statusCode: 200, headers, body: JSON.stringify({ taggedText: '' }) };
  }
};