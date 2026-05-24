/**
 * generate-bedtime-stories.js
 * Generates 90 bedtime stories using Claude + ElevenLabs v3
 * Run: node generate-bedtime-stories.js
 */

const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_KEY';
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY || 'YOUR_ELEVENLABS_KEY';
const VOICE_ID = 'vIdhHAZdn1bGjKe1dFw8';

const STORY_LIST = [
  // Scripture Contemplations
  { id: 1, type: 'scripture', title: 'Psalm 23 – The Lord Is My Shepherd', prompt: 'Write a 8-10 minute bedtime contemplation on Psalm 23. Read the psalm slowly with long pauses, then offer a gentle reflection for sleep.' },
  { id: 2, type: 'scripture', title: 'Jesus Calms the Storm', prompt: 'Write a 8-10 minute bedtime contemplation on Mark 4:35-41, Jesus calming the storm. Retell it slowly, then speak gently to the listener about the storms in their own heart tonight.' },
  { id: 3, type: 'scripture', title: 'The Road to Emmaus', prompt: 'Write a 8-10 minute bedtime contemplation on Luke 24:13-35, the Road to Emmaus. Retell it slowly with pauses, then invite the listener to recognize Christ walking beside them tonight.' },
  { id: 4, type: 'scripture', title: 'Be Still and Know', prompt: 'Write a 8-10 minute bedtime contemplation on Psalm 46:10. Meditate deeply on the phrase "Be still and know that I am God" for a soul entering sleep.' },
  { id: 5, type: 'scripture', title: 'The Prodigal Son', prompt: 'Write a 8-10 minute bedtime contemplation on Luke 15:11-32. Retell the parable slowly, then invite the listener to receive the Father\'s embrace as they sleep.' },
  { id: 6, type: 'scripture', title: 'Mary at the Feet of Jesus', prompt: 'Write a 8-10 minute bedtime contemplation on Luke 10:38-42. Meditate on Mary\'s choice of the better part — stillness, presence, listening — as a blessing for night prayer.' },
  { id: 7, type: 'scripture', title: 'The Our Father', prompt: 'Write a 8-10 minute bedtime contemplation praying through the Our Father line by line, very slowly, with long pauses for the listener to rest in each phrase.' },
  { id: 8, type: 'scripture', title: 'Elijah Under the Juniper Tree', prompt: 'Write a 8-10 minute bedtime contemplation on 1 Kings 19:1-8. Elijah is exhausted, afraid, and wants to die. An angel touches him twice and says "Arise and eat." A meditation for the exhausted soul.' },
  { id: 9, type: 'scripture', title: 'The Annunciation', prompt: 'Write a 8-10 minute bedtime contemplation on Luke 1:26-38. Meditate on Mary\'s fiat — her yes in the darkness — as a night prayer of surrender.' },
  { id: 10, type: 'scripture', title: 'Into Your Hands', prompt: 'Write a 8-10 minute bedtime contemplation on Psalm 31 and Luke 23:46 — "Into your hands I commend my spirit." A Compline meditation on surrender and trust at the close of day.' },

  // Desert Father Wisdom
  { id: 11, type: 'desert', title: 'Abba Moses on the Cell', prompt: 'Write a 8-10 minute bedtime story in the style of the Desert Fathers about Abba Moses and his teaching: "Go, sit in your cell, and your cell will teach you everything." Retell it slowly for night prayer.' },
  { id: 12, type: 'desert', title: 'Amma Syncletica on Temptation', prompt: 'Write a 8-10 minute bedtime contemplation drawing on Amma Syncletica\'s wisdom about temptation and perseverance. Speak gently to someone who has struggled today.' },
  { id: 13, type: 'desert', title: 'Abba Poemen on Thoughts', prompt: 'Write a 8-10 minute bedtime story about Abba Poemen\'s teaching on handling thoughts in prayer — letting them come and go like boats on a river. A meditation for a restless mind at night.' },
  { id: 14, type: 'desert', title: 'Abba Anthony and the Soldier', prompt: 'Write a 8-10 minute bedtime story about St Anthony the Great and the soldier who asked him how to be saved. Anthony\'s answer surprises him. A story about ordinary faithfulness.' },
  { id: 15, type: 'desert', title: 'Amma Sarah and the River', prompt: 'Write a 8-10 minute bedtime story about Amma Sarah who lived beside a river for sixty years and never looked at it — choosing always to look upward. A meditation on where we fix our gaze.' },
  { id: 16, type: 'desert', title: 'The Monk Who Could Not Forgive', prompt: 'Write a 8-10 minute bedtime story about a desert father who helped a monk release a long-held bitterness. A gentle story for anyone who goes to sleep carrying a grievance.' },
  { id: 17, type: 'desert', title: 'Abba Arsenius – Flee, Be Silent, Pray', prompt: 'Write a 8-10 minute bedtime contemplation on Abba Arsenius and the three words he received: Flee. Be silent. Pray always. A meditation for entering the night silence.' },
  { id: 18, type: 'desert', title: 'The Two Brothers', prompt: 'Write a 8-10 minute original bedtime story in the Desert Father style about two brothers who go to an elder with a dispute and leave in peace. A story about humility and reconciliation.' },
  { id: 19, type: 'desert', title: 'The Elder and the Beginner', prompt: 'Write a 8-10 minute bedtime story about an elder in the desert who receives a young novice. The novice asks the wrong question and receives a surprising answer about where holiness is found.' },
  { id: 20, type: 'desert', title: 'Abba Macarius and the Skull', prompt: 'Write a 8-10 minute bedtime story based on Abba Macarius and the pagan priest\'s skull that speaks to him. A meditation on prayer for the dead and the mercy of God.' },

  // Original Parables
  { id: 21, type: 'parable', title: 'The Well at the Edge of the Desert', prompt: 'Write a 8-10 minute original bedtime parable about a young monk who cannot understand why God feels distant. An elder teaches him about the bucket and the well. End with a blessing for sleep.' },
  { id: 22, type: 'parable', title: 'The Monk Who Made Lists', prompt: 'Write a 8-10 minute original bedtime parable about a monk who cannot stop making lists and an abbot who teaches him to put the notebook down. A gentle story for anxious minds.' },
  { id: 23, type: 'parable', title: 'The Candle That Burned Alone', prompt: 'Write a 8-10 minute original bedtime parable about a monk whose candle burns alone in a chapel during a storm. A meditation on fidelity in darkness and small acts of faithfulness.' },
  { id: 24, type: 'parable', title: 'The Gardener and the Dry Season', prompt: 'Write a 8-10 minute original bedtime parable about a monastery gardener who tends the garden through a long drought, trusting the rain will come. A story about faithfulness in the dark night of the soul.' },
  { id: 25, type: 'parable', title: 'The Novice Who Could Not Sing', prompt: 'Write a 8-10 minute original bedtime parable about a novice who cannot carry a tune but whose silent prayer moves an elder more than any chant. A story about the prayer God hears.' },
  { id: 26, type: 'parable', title: 'The Stone in the River', prompt: 'Write a 8-10 minute original bedtime parable about a stone that resists the river for years, then finally yields and becomes smooth. A meditation on surrender and transformation.' },
  { id: 27, type: 'parable', title: 'The Guestmaster\'s Last Guest', prompt: 'Write a 8-10 minute original bedtime parable about a monastery guestmaster who welcomes a stranger late at night. The stranger is not what he seems. A story about hospitality and the hidden Christ.' },
  { id: 28, type: 'parable', title: 'The Bell Ringer', prompt: 'Write a 8-10 minute original bedtime parable about a monk who rings the monastery bell for forty years, never knowing if anyone hears it. A story about faithful, unseen service.' },
  { id: 29, type: 'parable', title: 'The Two Prayers', prompt: 'Write a 8-10 minute original bedtime parable contrasting an eloquent monk whose prayer rises no higher than the ceiling and a simple brother whose single wordless groan reaches heaven. Based on Luke 18.' },
  { id: 30, type: 'parable', title: 'The Hermit and the Storm', prompt: 'Write a 8-10 minute original bedtime parable about a hermit who prays through a violent storm, discovering the storm is God visiting him. A story about recognizing God in difficulty.' },

  // Saint\'s Lives
  { id: 31, type: 'saint', title: 'St Benedict and the Cave', prompt: 'Write a 8-10 minute bedtime story about the young Benedict leaving Rome and spending three years alone in a cave at Subiaco. A meditation on the courage of withdrawal and silence.' },
  { id: 32, type: 'saint', title: 'St Thérèse and the Little Way', prompt: 'Write a 8-10 minute bedtime story about St Thérèse of Lisieux discovering her vocation — not to great deeds but to love in small things. A meditation for ordinary people doing ordinary things.' },
  { id: 33, type: 'saint', title: 'St Francis and the Wolf of Gubbio', prompt: 'Write a 8-10 minute bedtime story about St Francis and the wolf of Gubbio. Retell it slowly as a meditation on making peace with what frightens us.' },
  { id: 34, type: 'saint', title: 'St Scholastica\'s Last Night', prompt: 'Write a 8-10 minute bedtime story about St Scholastica\'s final meeting with her brother Benedict, when her tears called down a storm that kept him with her. A meditation on love that outlasts rules.' },
  { id: 35, type: 'saint', title: 'St John of the Cross in Prison', prompt: 'Write a 8-10 minute bedtime story about John of the Cross imprisoned by his own brothers, composing the Spiritual Canticle in the dark. A meditation for souls in their own darkness.' },
  { id: 36, type: 'saint', title: 'St Faustina and the Dark Night', prompt: 'Write a 8-10 minute bedtime story about St Faustina\'s experience of spiritual desolation — feeling abandoned by God — and what she discovered in that darkness. A meditation for the consolation of desolate souls.' },
  { id: 37, type: 'saint', title: 'St Teresa of Avila and the Kitchen', prompt: 'Write a 8-10 minute bedtime story about Teresa of Avila\'s famous saying that God walks among the pots and pans. A meditation on finding the sacred in ordinary daily life.' },
  { id: 38, type: 'saint', title: 'St Maximilian Kolbe\'s Choice', prompt: 'Write a 8-10 minute bedtime story about Maximilian Kolbe stepping forward to die in place of a stranger at Auschwitz. A meditation on love as sacrifice.' },
  { id: 39, type: 'saint', title: 'Julian of Norwich and All Shall Be Well', prompt: 'Write a 8-10 minute bedtime story about Julian of Norwich receiving her showings on her sickbed and the words that came to her: All shall be well, and all shall be well. A meditation for anxious nights.' },
  { id: 40, type: 'saint', title: 'St Ignatius and the Long Convalescence', prompt: 'Write a 8-10 minute bedtime story about Ignatius of Loyola wounded at Pamplona, lying in bed for months with only chivalric romances and saints\' lives to read — and what God did with that time.' },

  // Liturgical Season — Advent
  { id: 41, type: 'advent', title: 'Advent I — Waiting in the Dark', prompt: 'Write a 8-10 minute Advent bedtime contemplation for the first week of Advent. Meditate on holy waiting, darkness before dawn, and the soul\'s longing for God. End with a blessing for sleep.' },
  { id: 42, type: 'advent', title: 'Advent II — The Voice in the Desert', prompt: 'Write a 8-10 minute Advent bedtime contemplation on John the Baptist\'s voice in the desert — making straight paths, preparing the way. A meditation for interior preparation.' },
  { id: 43, type: 'advent', title: 'Advent III — The Annunciation at Night', prompt: 'Write a 8-10 minute Advent bedtime contemplation imagining Mary receiving the angel\'s message in the quiet of night. A meditation on saying yes in the dark.' },
  { id: 44, type: 'advent', title: 'Advent IV — O Come O Come Emmanuel', prompt: 'Write a 8-10 minute Advent bedtime contemplation on the O Antiphons — the ancient cries of the Church for the coming Messiah. A meditation for the soul in longing.' },
  { id: 45, type: 'advent', title: 'Christmas Eve — The Night Before', prompt: 'Write a 8-10 minute Christmas Eve bedtime contemplation on the world\'s last night before the Incarnation. A meditation on the holy night that changed everything.' },

  // Liturgical Season — Lent
  { id: 46, type: 'lent', title: 'Ash Wednesday — Remember You Are Dust', prompt: 'Write a 8-10 minute Ash Wednesday bedtime contemplation on mortality, humility, and the invitation to return. A meditation for the first night of Lent.' },
  { id: 47, type: 'lent', title: 'Lent — The Desert Temptations', prompt: 'Write a 8-10 minute Lenten bedtime contemplation on Jesus\' forty days in the desert — what He faced, what He chose, and what His desert means for our own.' },
  { id: 48, type: 'lent', title: 'Lent — The Transfiguration', prompt: 'Write a 8-10 minute Lenten bedtime contemplation on the Transfiguration. A meditation on the light that is always present beneath appearances — in Christ, and in us.' },
  { id: 49, type: 'lent', title: 'Lent — The Woman at the Well', prompt: 'Write a 8-10 minute Lenten bedtime contemplation on John 4 — Jesus and the Samaritan woman. A meditation on the thirst that only God can quench.' },
  { id: 50, type: 'lent', title: 'Holy Saturday — The Great Silence', prompt: 'Write a 8-10 minute Holy Saturday bedtime contemplation on the day between the Cross and the Resurrection. A meditation for waiting in darkness when God seems absent.' },

  // Liturgical Season — Easter & Ordinary Time
  { id: 51, type: 'easter', title: 'Easter Sunday — He Is Not Here', prompt: 'Write a 8-10 minute Easter bedtime contemplation on the empty tomb. A meditation on the Resurrection as the answer to every fear and darkness.' },
  { id: 52, type: 'easter', title: 'Easter — Mary Magdalene in the Garden', prompt: 'Write a 8-10 minute bedtime contemplation on Mary Magdalene at the empty tomb, weeping, then hearing her name spoken. A meditation on being known and called by name.' },
  { id: 53, type: 'ordinary', title: 'Ordinary Time — The Hidden Life of Nazareth', prompt: 'Write a 8-10 minute bedtime contemplation on the thirty hidden years of Jesus in Nazareth — the holiness of unseen ordinary life. A meditation for people whose days feel unremarkable.' },
  { id: 54, type: 'ordinary', title: 'Ordinary Time — The Mustard Seed', prompt: 'Write a 8-10 minute bedtime contemplation on the parable of the mustard seed. A meditation on small beginnings, hidden growth, and trust in what God is doing invisibly.' },
  { id: 55, type: 'ordinary', title: 'Ordinary Time — Casting Nets', prompt: 'Write a 8-10 minute bedtime contemplation on the disciples casting their nets all night and catching nothing, then catching everything at Jesus\' word. A meditation for those who feel their labor is fruitless.' },

  // Compline — Pure Night Prayer
  { id: 56, type: 'compline', title: 'Compline I — Into Your Hands', prompt: 'Write a 8-10 minute Compline prayer for the close of day. Begin with an examination of conscience, move into surrender, and close with the ancient prayer: Into your hands I commend my spirit.' },
  { id: 57, type: 'compline', title: 'Compline II — Night Watch', prompt: 'Write a 8-10 minute Compline prayer meditating on God\'s watch through the night — He who neither slumbers nor sleeps. A prayer for handing the night over to God.' },
  { id: 58, type: 'compline', title: 'Compline III — The Examination', prompt: 'Write a 8-10 minute Compline prayer guiding the listener through a gentle Ignatian examen — gratitude, review of the day, sorrow, hope, surrender. End in silence.' },
  { id: 59, type: 'compline', title: 'Compline IV — Salve Regina', prompt: 'Write a 8-10 minute Compline prayer meditating on the Salve Regina — the ancient night prayer to Mary. Pray it slowly, line by line, with reflection.' },
  { id: 60, type: 'compline', title: 'Compline V — The Night Office', prompt: 'Write a 8-10 minute Compline prayer in the spirit of the monastic night office — psalms, silence, surrender. A prayer for those who want to end their day as monks end theirs.' },

  // More Parables
  { id: 61, type: 'parable', title: 'The Monk and the Mirror', prompt: 'Write a 8-10 minute original bedtime parable about a monk who cannot stop looking at his reflection — his faults, his failures — and the elder who teaches him to look at Christ instead.' },
  { id: 62, type: 'parable', title: 'The Empty Chair', prompt: 'Write a 8-10 minute original bedtime parable about a monk who places an empty chair in his cell for Christ and prays as if Christ is sitting there. Based loosely on Brother Lawrence.' },
  { id: 63, type: 'parable', title: 'The Manuscript', prompt: 'Write a 8-10 minute original bedtime parable about a monk who copies Scripture by hand for forty years without seeing if anyone ever reads it. A story about faithfulness without reward.' },
  { id: 64, type: 'parable', title: 'The Night the Bell Broke', prompt: 'Write a 8-10 minute original bedtime parable about what happened the night the monastery bell broke and the community had to find another way to call themselves to prayer.' },
  { id: 65, type: 'parable', title: 'The Pilgrim at the Gate', prompt: 'Write a 8-10 minute original bedtime parable about a pilgrim who arrives at a monastery gate exhausted and is turned away — then welcomed by the last monk he expected. A story about unexpected grace.' },

  // More Desert Father
  { id: 66, type: 'desert', title: 'The Elder Who Wept', prompt: 'Write a 8-10 minute bedtime story about an elder known for tears of compunction — and why the desert fathers considered tears a gift. A meditation on holy sorrow and tenderness of heart.' },
  { id: 67, type: 'desert', title: 'Abba Lot and the Fire', prompt: 'Write a 8-10 minute bedtime story about Abba Lot asking Abba Joseph what more he can do, and Abba Joseph stretching out his hands like flames: "If you will, you can become all flame." A meditation on total surrender to God.' },
  { id: 68, type: 'desert', title: 'The Monk Who Left and Returned', prompt: 'Write a 8-10 minute original Desert Father bedtime story about a monk who leaves the desert in discouragement and returns years later to find the elder still in his cell, still praying. A story about steadfastness.' },
  { id: 69, type: 'desert', title: 'Amma Theodora on Afflictions', prompt: 'Write a 8-10 minute bedtime contemplation on Amma Theodora\'s teaching that no ascetic practice — fasting, vigils, labor — drives away the demon of acedia as well as perseverance and hope.' },
  { id: 70, type: 'desert', title: 'The Last Word of the Elder', prompt: 'Write a 8-10 minute original bedtime story about a young monk who travels far to receive a word from a dying elder. The word he receives is not what he expected. A meditation on what matters most.' },

  // More Saints
  { id: 71, type: 'saint', title: 'St Augustine\'s Restless Heart', prompt: 'Write a 8-10 minute bedtime story about Augustine\'s long journey to God — the years of searching, pleasure, philosophy, grief — and the moment in the garden when he finally heard. A meditation on the God who never stops pursuing.' },
  { id: 72, type: 'saint', title: 'St Padre Pio\'s Night', prompt: 'Write a 8-10 minute bedtime story about Padre Pio\'s nights in prayer — the spiritual battles, the suffering, the consolations. A meditation for those who struggle in the dark.' },
  { id: 73, type: 'saint', title: 'Blessed Charles de Foucauld in the Desert', prompt: 'Write a 8-10 minute bedtime story about Charles de Foucauld\'s hidden years in the Sahara, living alone among the Tuareg. A meditation on hiddenness, presence, and the silent witness of a life.' },
  { id: 74, type: 'saint', title: 'St Joseph the Dreamer', prompt: 'Write a 8-10 minute bedtime story about St Joseph receiving his angels in dreams — the annunciation, the flight to Egypt, the return. A meditation on God who speaks in sleep.' },
  { id: 75, type: 'saint', title: 'Thomas Merton\'s First Night at Gethsemani', prompt: 'Write a 8-10 minute bedtime story about Thomas Merton\'s first night as a postulant at the Abbey of Gethsemani — what he heard, what he felt, what he knew. A meditation on the moment of arrival.' },

  // Scripture — More
  { id: 76, type: 'scripture', title: 'The Garden of Gethsemane', prompt: 'Write a 8-10 minute bedtime contemplation on Jesus in the Garden of Gethsemane — His prayer, His sweat like blood, His surrender. A meditation for anyone facing something they dread.' },
  { id: 77, type: 'scripture', title: 'Come to Me All You Who Are Weary', prompt: 'Write a 8-10 minute bedtime contemplation on Matthew 11:28-30 — Come to me all you who are weary and burdened. A meditation for the exhausted soul entering sleep.' },
  { id: 78, type: 'scripture', title: 'The Beatitudes at Night', prompt: 'Write a 8-10 minute bedtime contemplation praying through the Beatitudes slowly, one by one, as a blessing spoken over the listener as they prepare for sleep.' },
  { id: 79, type: 'scripture', title: 'I Am the Good Shepherd', prompt: 'Write a 8-10 minute bedtime contemplation on John 10:1-18. Meditate on the Shepherd who knows each sheep by name, who lays down his life, who never loses one. A meditation for the loved and known soul.' },
  { id: 80, type: 'scripture', title: 'The Magnificat', prompt: 'Write a 8-10 minute bedtime contemplation on the Magnificat — Mary\'s song of praise. Pray it slowly line by line as an evening canticle of surrender and joy.' },

  // Final stories — mixed
  { id: 81, type: 'parable', title: 'The Lamp in the Window', prompt: 'Write a 8-10 minute original bedtime parable about a monk who keeps a lamp burning in his window every night for forty years. He never knows who sees it. A story about faithfulness and witness.' },
  { id: 82, type: 'desert', title: 'The Three Questions', prompt: 'Write a 8-10 minute bedtime story in the Desert Father style about a young monk who comes to an elder with three questions. He receives one answer that contains all three. A meditation on simplicity.' },
  { id: 83, type: 'saint', title: 'St Clare\'s Watch', prompt: 'Write a 8-10 minute bedtime story about St Clare of Assisi watching through the night in prayer. A meditation on vigil, fidelity, and the quiet heroism of the hidden life.' },
  { id: 84, type: 'scripture', title: 'The Grain of Wheat', prompt: 'Write a 8-10 minute bedtime contemplation on John 12:24 — unless a grain of wheat falls into the ground and dies. A meditation on necessary dying, hidden growth, and the promise of fruit.' },
  { id: 85, type: 'parable', title: 'The Abbot\'s Question', prompt: 'Write a 8-10 minute original bedtime parable about an abbot who asks his community a single question each year. This year the question breaks something open. A story about the transforming power of the right question.' },
  { id: 86, type: 'ordinary', title: 'The Potter and the Clay', prompt: 'Write a 8-10 minute bedtime contemplation on Jeremiah 18:1-6 — the potter and the clay. A meditation on yielding, being remade, and trusting the hands that shape us.' },
  { id: 87, type: 'desert', title: 'The Word That Was Enough', prompt: 'Write a 8-10 minute original Desert Father bedtime story about a monk who receives a single word from an elder and carries it his entire life. A meditation on the sufficiency of one true thing.' },
  { id: 88, type: 'saint', title: 'St Seraphim of Sarov and the Bear', prompt: 'Write a 8-10 minute bedtime story about St Seraphim of Sarov feeding a bear from his hand in the forest. A meditation on the restoration of Eden in the holy soul.' },
  { id: 89, type: 'compline', title: 'Compline VI — The Final Prayer', prompt: 'Write a 8-10 minute Compline prayer for the very last night — whenever that may be. A meditation on dying daily, on every sleep as a rehearsal for death, and on the hope of resurrection morning.' },
  { id: 90, type: 'parable', title: 'The Monk Who Found What He Was Looking For', prompt: 'Write a 8-10 minute final bedtime parable — the last story in the series — about a monk who spent his whole life looking for God and found Him in the last place he expected. A fitting end to 90 nights.' },
];

const STORY_SYSTEM_PROMPT = `You are writing contemplative bedtime stories for Still, a Catholic prayer app. 

Each story should be 8-10 minutes when read aloud at a slow, meditative pace (approximately 1,200-1,400 words).

STYLE RULES:
- Write in a warm, unhurried, deeply human voice
- Use long pauses marked as <break time="2.0s"> between sections
- Use <break time="1.0s"> within sections for breathing room
- Use <whisper> for the most sacred or intimate lines — maximum once per story
- Use <sigh> for moments of deep feeling — maximum once per story
- Never rush. Every sentence should feel like it has room to breathe.
- End EVERY story with a direct blessing spoken to the listener — addressing them as "you" — inviting them into rest and sleep
- The final lines should always slow to almost nothing — one word at a time if needed

FORBIDDEN:
- Never use markdown formatting (no **, no #, no *)
- Never use lists or bullet points
- Never use modern psychological language
- Never be preachy or moralistic
- Never explain the meaning — let the story carry it

FORMAT:
- Title on first line
- Then the story
- Return ONLY the tagged story text, nothing else`;

async function generateStory(storyItem) {
  console.log(`  Generating story: ${storyItem.title}...`);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: STORY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: storyItem.prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text;
}

async function generateAudio(text, storyId) {
  console.log(`  Generating audio for story ${storyId}...`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
        speed: 0.82,
      },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs error: ${await res.text()}`);
  return await res.arrayBuffer();
}

async function main() {
  const outputDir = path.join(__dirname, 'still-mobile', 'assets', 'stories');
  const textDir = path.join(__dirname, 'still-mobile', 'assets', 'stories', 'text');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(textDir)) fs.mkdirSync(textDir, { recursive: true });

  // Check which stories already exist
  const toGenerate = STORY_LIST.filter(s => {
    const mp3Path = path.join(outputDir, `story_${String(s.id).padStart(3, '0')}.mp3`);
    return !fs.existsSync(mp3Path);
  });

  console.log(`\nGenerating ${toGenerate.length} stories (${STORY_LIST.length - toGenerate.length} already done)\n`);

  for (const story of toGenerate) {
    console.log(`\n[${story.id}/90] ${story.title}`);
    try {
      const text = await generateStory(story);
      console.log(`  ✓ Story generated (${text.length} chars)`);

      // Save text for reference
      const textPath = path.join(textDir, `story_${String(story.id).padStart(3, '0')}.txt`);
      fs.writeFileSync(textPath, `${story.title}\n\n${text}`);

      const audioBuffer = await generateAudio(text, story.id);
      const mp3Path = path.join(outputDir, `story_${String(story.id).padStart(3, '0')}.mp3`);
      fs.writeFileSync(mp3Path, Buffer.from(audioBuffer));
      console.log(`  ✓ Audio saved: ${mp3Path}`);

      // Small delay between stories to be nice to the APIs
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  ✗ Failed for story ${story.id}:`, err.message);
    }
  }

  // Save manifest
  const manifest = STORY_LIST.map(s => ({
    id: s.id,
    title: s.title,
    type: s.type,
    file: `story_${String(s.id).padStart(3, '0')}.mp3`,
  }));
  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\nDone! Push still-mobile/assets/stories/ to git.');
}

main();