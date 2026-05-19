/**
 * generate-demo-audio.js
 * Run this ONCE locally to generate the three onboarding demo mp3 files.
 *
 * Usage:
 *   node generate-demo-audio.js
 *
 * Requires: node-fetch (or Node 18+ with built-in fetch)
 * Output: saves three mp3 files to still-mobile/assets/
 *
 * Set your ElevenLabs API key and Anthropic key below,
 * or use environment variables.
 */

const fs   = require('fs');
const path = require('path');

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY || 'YOUR_ELEVENLABS_KEY';
const ANTHROPIC_API_KEY   = process.env.ANTHROPIC_API_KEY   || 'YOUR_ANTHROPIC_KEY';

const VOICE_IDS = {
  ammaSophia: 'ULbmvN3ajvtnzNTG88G8',
  deeper:     'DzcRs71mIqvZ5truEdVC',
  companion:  'B5jEZPqk2OJ2vkPw3wBM',
};

// ─── The three demo responses (plain text, before tagging) ───────────────

const DEMO_TEXTS = {
  ammaSophia: `Child, you have not lost that door — you have grown larger than the room you first entered. What felt like eternity then was real. It was a mercy, a first taste given freely so you would know what you were hungry for. But the Lord does not repeat himself in the same way twice. He is not hiding. He is asking you to find him in a new country — one that requires more of you than wonder. Sit with the silence you once found easy. Do not demand the feeling. Offer him the wanting itself. That is the deeper prayer. The one he has been waiting for.`,

  deeper: `This is the question that has broken and remade every serious theologian who has lived. Do not be ashamed of it. Augustine wept over it. Aquinas circled it for years. The Catechism does not flinch from it either — it holds together God's omnipotence, his love, human freedom, and the mystery of hell without collapsing any one into the other. What the tradition will not allow is the shortcut — either a God too weak to stop suffering, or one too indifferent to care. What it insists on instead is harder: that love which cannot be refused is not love, that freedom is the condition of genuine relation, and that the same liberty which makes sanctity possible makes damnation possible. This does not dissolve the anguish of the question. It shouldn't. But it means your anger is not outside the faith. It is, in fact, one of its oldest prayers.`,

  companion: `Be quiet. What you have found was not given to you for display. The desert teaches this above all else — that the one who speaks of his treasure too quickly loses it, not because God takes it back, but because the speaking becomes the substitute for the living. Guard it. Let it deepen. If it is real it will overflow without your management. And when it does, the overflow itself will speak more clearly than any word you could have chosen. Until then — return to your cell.`,
};

// ─── Character tagging prompts ────────────────────────────────────────────

const CHARACTER_PROMPTS = {
  companion: `You are preparing a response from The Companion — a voice drawn from the Desert Fathers.
Imagine Abba Moses speaking quietly in a desert cell at dusk. Unhurried. Every word chosen carefully.
Long silences between thoughts. When he speaks of God there is wonder, not lecture.
The voice never rushes. It rests between sentences like a monk between psalms.
The most important words get their own breath. Their own line. Their own moment of silence after.`,

  ammaSophia: `You are preparing a response from Amma Sophia — an elderly desert mother who has prayed for decades.
Imagine her speaking by candlelight in a stone room. Her voice carries weight but never harshness.
She speaks with deep warmth — like someone who has wept and also laughed before God.
She addresses the listener as "Child" or "Dear one" — intimate, maternal, unhurried.
She pauses before the most important words. She lets silence do work that words cannot.
When she asks a question she means it — she is not performing, she is actually wondering with you.
The most important theological truth in each response gets its own line — one sentence, standing alone.`,

  deeper: `You are preparing a response from Deeper — a spiritual father who has studied and prayed for forty years.
Imagine a confessor speaking quietly after a long silence in a dark chapel. Precise but not cold.
He addresses the listener as "Beloved" — direct, personal, from love not duty.
He names difficult things without flinching but always from love.
He slows down for the most important theological truths — lets them land before moving on.
A single declarative anchor sentence — the most important truth — stands alone on its own line.
Everything else breathes around it.`,
};

const TAG_SYSTEM = `You are preparing this text for ElevenLabs Eleven v3 voice synthesis.
Your job is to add emotional delivery tags, breathing pauses, and natural line breaks
so that when spoken aloud, this response sounds like a real human being — 
not an AI reading text, but a person speaking from the depths of prayer and wisdom.

VALID TAGS — use these and only these:
[sighs] — before a moment of weight, grief, resignation, or deep feeling. Use once.
[whispers] — for the most intimate, sacred, or quietly devastating line. Use once.
[slowly] — for the single most important sentence that must land. Use once.
[warmly] — for direct personal address or a moment of tenderness. Use once.

NATURAL PACING RULES:
- Add "..." inside sentences where the speaker would naturally pause or breathe
- Break long sentences into shorter breath-length lines with a line break between them
- The single most important truth gets its own line — one sentence, nothing before or after it on that line
- A question at the end stands completely alone on its own line
- Think of line breaks as the speaker taking a breath between thoughts

RULES — never break these:
- Maximum 3 tags per response — fewer is better
- Tags go BEFORE the sentence or phrase they apply to
- "..." goes INSIDE sentences at natural pause points — never at the end of a line
- NEVER use: [thoughtful] [pause] [reverent] [warm] [gentle] [slow] [serious] [tender] [sad] [quiet]
- Preserve ALL original words exactly — only add tags, punctuation, and line breaks
- Return ONLY the tagged text, nothing else`;

// ─── Step 1: Tag the text ─────────────────────────────────────────────────

async function tagText(text, character) {
  console.log(`  Tagging ${character}...`);
  const systemPrompt = CHARACTER_PROMPTS[character] + '\n\n' + TAG_SYSTEM;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || text;
}

// ─── Step 2: Generate audio ───────────────────────────────────────────────

async function generateAudio(taggedText, character) {
  console.log(`  Generating audio for ${character}...`);
  const voiceId = VOICE_IDS[character];

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: taggedText.trim(),
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
          speed: 0.88,
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`ElevenLabs error: ${await res.text()}`);
  return await res.arrayBuffer();
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const outputDir = path.join(__dirname, 'still-mobile', 'assets');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const [character, text] of Object.entries(DEMO_TEXTS)) {
    console.log(`\nProcessing ${character}...`);
    try {
      const taggedText  = await tagText(text, character);
      console.log(`  Tagged text:\n${taggedText}\n`);

      const audioBuffer = await generateAudio(taggedText, character);
      const filePath    = path.join(outputDir, `${character}_demo.mp3`);
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      console.log(`  ✓ Saved: ${filePath}`);
    } catch (err) {
      console.error(`  ✗ Failed for ${character}:`, err.message);
    }
  }

  console.log('\nDone. Add the three mp3 files to git and push.');
}

main();