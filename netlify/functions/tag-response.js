// netlify/functions/tag-response.js
// Still — Claude emotional tagging for ElevenLabs v3
// Called immediately after AI response is generated, runs in background

const CHARACTER_PROMPTS = {
  companion: `You are preparing a response from The Companion — a voice drawn from the Desert Fathers.
Imagine Abba Moses speaking quietly in a desert cell at dusk. Unhurried. Every word chosen carefully.
Long silences between thoughts. When he speaks of God there is wonder, not lecture.
The voice never rushes. It rests between sentences like a monk between psalms.`,

  ammaSophia: `You are preparing a response from Amma Sophia — a desert mother who has prayed for decades.
Imagine an elderly woman speaking by candlelight. Her voice carries weight but never harshness.
She speaks with deep warmth — like someone who has wept and also laughed before God.
She pauses before the most important words. She lets silence do work that words cannot.
When she asks a question she means it — she is not performing, she is actually wondering with you.`,

  deeper: `You are preparing a response from Deeper — a spiritual father who has studied and prayed for forty years.
Imagine a confessor speaking quietly after a long silence. Precise but not cold.
He names difficult things without flinching but always from love.
He slows down for the most important theological truths — lets them land before moving on.
A single declarative sentence sometimes gets its own breath, its own moment.`
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
Add emotional delivery tags and natural pacing to bring this character to life.

Valid tags for Eleven v3:
[sighs] — before a moment of weight, resignation, or deep feeling
[whispers] — for intimate, quiet, sacred moments
[slowly] — for the most important sentences that need to land
[warmly] — for direct personal address, moments of tenderness

Also use natural pacing:
- Add "..." for pauses within sentences where the speaker would breathe or wait
- Break long sentences at natural breath points with a line break
- A single powerful sentence can stand alone as its own paragraph
- These work alongside the bracket tags

Example of good tagging for Amma Sophia:
"Child... [slowly] I have been sitting with these words this morning.

[sighs] All shall be well.

And all manner of thing shall be well.

[whispers] Not because the pain is not real — but because He who holds it is.

[warmly] What are you being invited to trust today?"

Rules:
- Maximum 3 tags per response — use them sparingly so they carry weight
- Tags go BEFORE the sentence or phrase they apply to
- "..." goes INSIDE sentences at natural pause points
- Line breaks between thoughts where a speaker would breathe
- NEVER use: [thoughtful] [pause] [reverent] [warm] [gentle] [slow] [serious] — these are NOT valid v3 tags and will be spoken aloud
- Preserve ALL original words exactly — only add tags, punctuation, and line breaks
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
    return { statusCode: 200, headers, body: JSON.stringify({ taggedText: '' }) };
  }
};