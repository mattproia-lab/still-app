// netlify/functions/elevenlabs-tts.js
// Still — ElevenLabs v3 TTS with Supabase caching
// Returns base64 audio to avoid streaming timeout issues

const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

const VOICE_IDS = {
  companion:  'wyWA56cQNU2KqUW4eCsI',
  ammaSophia: 'ULbmvN3ajvtnzNTG88G8',
  deeper:     'DzcRs71mIqvZ5truEdVC'
};

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function checkCache(textHash, serviceKey) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/voice_cache?text_hash=eq.${textHash}&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0].audio_url : null;
  } catch(e) { return null; }
}

async function saveCache(textHash, audioBuffer, character, serviceKey) {
  try {
    const fileName = `${textHash}-${Date.now()}.mp3`;
    const uploadRes = await fetch(
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
    if (!uploadRes.ok) return;
    const audioUrl = `${SUPA_URL}/storage/v1/object/public/voice-audio/${fileName}`;
    await fetch(`${SUPA_URL}/rest/v1/voice_cache`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ text_hash: textHash, audio_url: audioUrl, character })
    });
  } catch(e) { console.error('Cache save error:', e.message); }
}

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
    if (!VOICE_IDS[character]) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown character: ${character}` }) };

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
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

    // Generate via ElevenLabs v3
    const voiceId = VOICE_IDS[character];
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_flash_v2_5',
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

    if (!elevenRes.ok) {
      const err = await elevenRes.text();
      throw new Error(`ElevenLabs error: ${err}`);
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Cache in background
    saveCache(textHash, audioBuffer, character, serviceKey).catch(console.error);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioBase64, cached: false })
    };

  } catch (err) {
    console.error('TTS error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};