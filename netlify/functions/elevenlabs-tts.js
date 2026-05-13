// netlify/functions/elevenlabs-tts.js
// Still — ElevenLabs TTS with Supabase caching and Claude emotional tagging
// Handles: Companion, Amma Sophia, Deeper voice generation

const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

const VOICE_IDS = {
  companion:   'ePiPWpzcHZrcqRzFrgQg',
  ammaSophia:  'uhYnkYTBc711oAY590Ea',
  deeper:      'DzcRs71mIqvZ5truEdVC'
};

const CHARACTER_PROMPTS = {
  companion: `You are preparing a response from The Companion — a contemplative spiritual guide 
formed by the wisdom of the Desert Fathers. The voice is calm, grounded, unhurried. 
Like a monk who has learned to listen before speaking.`,
  ammaSophia: `You are preparing a response from Amma Sophia — an ancient desert mother who answers 
with the voice of the mystics and the early Church. Warm but not soft. Wise but not academic. 
She has walked this road a long time.`,
  deeper: `You are preparing a response from Deeper — a theological guide who has read everything 
and is now very still. Authoritative but not cold. Formal but deeply personal.`
};

// Generate a hash from text for cache lookup
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Check Supabase cache for existing audio
async function checkCache(textHash, serviceKey) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/voice_cache?text_hash=eq.${textHash}&limit=1`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.length > 0 ? data[0].audio_url : null;
}

// Save audio URL to Supabase cache
async function saveCache(textHash, audioUrl, character, serviceKey) {
  await fetch(`${SUPA_URL}/rest/v1/voice_cache`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      text_hash: textHash,
      audio_url: audioUrl,
      character: character
    })
  });
}

// Upload audio buffer to Supabase Storage
async function uploadAudio(audioBuffer, textHash, serviceKey) {
  const fileName = `${textHash}-${Date.now()}.mp3`;
  const res = await fetch(
    `${SUPA_URL}/storage/v1/object/voice-audio/${fileName}`,
    {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'true'
      },
      body: audioBuffer
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed: ${err}`);
  }
  return `${SUPA_URL}/storage/v1/object/public/voice-audio/${fileName}`;
}

// Add emotional tags via Claude
async function addEmotionalTags(text, character, anthropicKey) {
  const systemPrompt = `${CHARACTER_PROMPTS[character]}

You are preparing this text for sacred audio reading using ElevenLabs voice synthesis.
Add emotional delivery tags to guide the voice performance.

Available tags:
[thoughtful] - for reflective, contemplative moments
[gentle] - for pastoral comfort, difficult truths spoken with care  
[slow] - for Scripture quotes, key sentences that need weight
[pause] - after questions, between sections, moments of silence
[reverent] - for Scripture, direct quotes from saints
[warm] - for personal address, moments of intimacy
[serious] - for darker content, hard truths

Rules:
- Preserve ALL original text exactly — do not change a single word
- Only ADD tags before phrases or sentences
- Use tags sparingly — not every sentence needs one
- Always start with a tag
- Return ONLY the tagged text, nothing else, no preamble`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    })
  });

  if (!res.ok) return text; // Fall back to untagged text
  const data = await res.json();
  return data.content?.[0]?.text || text;
}

// Generate audio via ElevenLabs
async function generateAudio(taggedText, voiceId, elevenLabsKey) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: taggedText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
          speed: 0.88
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  return res.arrayBuffer();
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { text, character } = JSON.parse(event.body);

    if (!text || !character) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'text and character are required' })
      };
    }

    if (!VOICE_IDS[character]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Unknown character: ${character}` })
      };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;

    // Generate cache key from text
    const textHash = hashText(text.trim());

    // Check cache first
    const cachedUrl = await checkCache(textHash, serviceKey);
    if (cachedUrl) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cachedUrl, cached: true })
      };
    }

    // Add emotional tags via Claude
    const taggedText = await addEmotionalTags(text, character, anthropicKey);

    // Generate audio via ElevenLabs
    const voiceId = VOICE_IDS[character];
    const audioBuffer = await generateAudio(taggedText, voiceId, elevenLabsKey);

    // Upload to Supabase Storage
    const audioUrl = await uploadAudio(audioBuffer, textHash, serviceKey);

    // Save to cache
    await saveCache(textHash, audioUrl, character, serviceKey);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: audioUrl, cached: false })
    };

  } catch (err) {
    console.error('TTS error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};