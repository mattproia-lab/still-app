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

You are preparing this text for sacred audio reading using ElevenLabs v3 voice synthesis.
Add emotional delivery tags to guide the voice performance.

Available tags for ElevenLabs v3:
[thoughtful] - reflective, contemplative moments
[gentle] - pastoral comfort, difficult truths spoken with care
[slow] - Scripture quotes, key sentences needing weight
[pause] - after questions, between sections
[reverent] - Scripture, direct quotes from saints
[warm] - personal address, moments of intimacy
[serious] - darker content, hard truths

Rules:
- Preserve ALL original text exactly — do not change a single word
- Only ADD tags before phrases or sentences
- Use tags sparingly — not every sentence needs one
- Always open with a tag
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