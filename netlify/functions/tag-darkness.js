// netlify/functions/tag-darkness.js
// Tagging for Dark Mode reflections — Amma Sophia reading in darkness

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { text, title } = JSON.parse(event.body);
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'text required' }) };

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const systemPrompt = `You are preparing a reflection for ElevenLabs Eleven v3 voice synthesis.
This reflection will be spoken by Amma Sophia — an elderly desert mother — 
in the context of Still's Dark Mode, where users come in spiritual darkness, desolation, or grief.

The texts are: Psalm 88, Psalm 22, Lamentations, John of the Cross, Thérèse of Lisieux, Ignatius on Desolation.
This specific reflection is about: ${title}

Amma Sophia speaks these reflections as someone who has herself sat in darkness for long seasons.
She does not rush. She does not console cheaply. She speaks with the weight of someone who knows.
She addresses no one directly — she speaks as if thinking aloud in the dark beside the listener.

VALID TAGS:
[sighs] — before a line of particular weight or grief
[whispers] — for the most sacred or devastating line
[slowly] — for the single most important truth that must land in silence

PACING RULES:
- Every distinct thought gets its own line
- "..." inside sentences where she would pause and breathe
- The most important sentence stands completely alone
- Maximum 2 tags — in darkness, silence carries more weight than expression
- Never use: [warmly] [thoughtful] [pause] [reverent] [warm] [gentle] [serious]
- Preserve ALL original words exactly
- Return ONLY the tagged text

EXAMPLE for "John wrote this while imprisoned":
"[slowly] John wrote this while imprisoned in a cell six feet by ten feet... by his own order.

He was beaten regularly.

[whispers] He was nearly starved.

His theology of darkness came from inside it.

He had earned the right to say what he said."`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
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
    console.error('Tag darkness error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ taggedText: '' }) };
  }
};