/* ═══════════════════════════════════════════════════════════════
   fetch-rosary-images.mjs
   Sources all 101 mystery images from Wikimedia Commons.

   Run from still-app/tools:
     node fetch-rosary-images.mjs            → downloads to ../rosary/img/
     node fetch-rosary-images.mjs --dry      → prints matches, downloads nothing

   All works are pre-1900 → public domain (PD-Art). Commons search
   usually nails these on the first hit; the script writes a
   report (rosary-image-report.json) listing what it matched so
   you can eyeball it and re-run individual slugs with an
   override if any match is wrong:
     node fetch-rosary-images.mjs annunciation-duccio "File:Duccio di Buoninsegna 040.jpg"
═══════════════════════════════════════════════════════════════ */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const OUT = '../www/assets/rosary';
const WIDTH = 1200;            // rendered at 4:3 card, 1200px is plenty
const API = 'https://commons.wikimedia.org/w/api.php';

/* slug → Commons search query. Default: hyphens → spaces.
   OVERRIDES for slugs whose literal words won't find the work. */
/* Exact Commons files, verified by hand — used instead of search */
const FORCE = {
  'carrying-byzantine-icon':     'File:Golgotha (The Bearing of the Cross and the Crucifixion).png',
  'presentation-byzantine-icon': 'File:Sretenie (Russian museum, 15 c).jpg',
  'sermon-on-the-mount-fra-angelico': 'File:Fra Angelico, Sermon on the Mount, 1446-43; Convent of San Marco, Florence.jpg',
  'assumption-poussin':          'File:Nicolas Poussin, The Assumption of the Virgin, c. 1630-1632, NGA 46470.jpg',
  'coronation-fra-angelico':     'File:Le Couronnement de la Vierge - Fra Angelico - Musée du Louvre Peintures INV 314 ; MR 220.jpg',
  'ecce-homo-ciseri':            'File:Ecce homo by Antonio Ciseri (1).jpg',
  'nativity-correggio':          'File:Correggio - The Holy Night - Google Art Project.jpg',
  'noli-me-tangere-fra-angelico':'File:Fra Angelico, Noli Me Tangere, 1440-41; Convent of San Marco, Florence (1).jpg',
};

const OVERRIDES = {
  'christ-preaching-hundred-guilder': 'Hundred Guilder Print Rembrandt',
  'carrying-raphael-spasimo':         'Lo Spasimo Raphael Christ Falling',
  'finding-hunt':                     'Finding of the Saviour in the Temple Holman Hunt',
  'finding-durer':                    'Christ among the Doctors Dürer',
  'finding-byzantine-icon':           'Christ among the doctors icon',
  'mystical-supper-icon':             'Mystical Supper icon Last Supper',
  'anastasis-byzantine-icon':         'Anastasis fresco Chora',
  'theophany-byzantine-icon':         'Theophany Baptism of Christ icon',
  'dormition-byzantine-icon':         'Dormition of the Theotokos icon',
  'coronation-martorana-mosaic':      'Martorana mosaic coronation',
  'sower-millet':                     'The Sower Jean-François Millet',
  'baptism-piero':                    'Baptism of Christ Piero della Francesca',
  'flagellation-piero':               'Flagellation of Christ Piero della Francesca',
  'resurrection-piero':               'Resurrection Piero della Francesca',
  'flagellation-bouguereau':          'Flagellation of Our Lord Bouguereau',
  'healing-paralytic-van-dyck':       'Healing of the Paralytic Van Dyck',
  'calling-peter-andrew-duccio':      'Calling of the Apostles Peter and Andrew Duccio',
  'visitation-eastern-icon':          'Visitation icon Mary Elizabeth',
  'presentation-lorenzetti':          'Presentation in the Temple Ambrogio Lorenzetti',
  'transfiguration-theophanes-icon':  'Transfiguration Theophanes the Greek',
  'noli-me-tangere-fra-angelico':     'Fra Angelico Noli me tangere San Marco',
  'communion-of-the-apostles-fra-angelico': 'Communion of the Apostles Fra Angelico',
  // ── corrected after first audit ──
  'annunciation-simone-martini':  'Simone Martini Annunciation with two saints Uffizi painting',
  'assumption-murillo':           'Murillo Assumption of the Virgin',
  'assumption-poussin':           'Poussin Assumption of the Virgin National Gallery of Art Washington',
  'assumption-titian':            'Tiziano Assunta Frari',
  'cana-byzantine-icon':          'Marriage at Cana fresco Visoki Decani',
  'carrying-byzantine-icon':      'Christ carrying cross Byzantine fresco',
  'carrying-duccio':              'Duccio Maesta Way to Calvary',
  'coronation-el-greco':          'El Greco Coronation of the Virgin Prado',
  'coronation-fra-angelico':      'Fra Angelico Coronation of the Virgin Louvre',
  'crowning-byzantine-icon':      'Christ the Bridegroom Nymphios icon',
  'crucifixion-velazquez':        'Cristo crucificado Velazquez Prado',
  'ecce-homo-ciseri':             'Antonio Ciseri Ecce Homo Pilate',
  'finding-duccio':               'Duccio Christ among the Doctors Maesta',
  'finding-simone-martini':       'Simone Martini Christ Discovered in the Temple',
  'flagellation-byzantine-icon':  'Cimabue Flagellation of Christ',
  'gethsemane-byzantine-icon':    'Agony in the Garden Byzantine',
  'last-supper-juan-de-juanes':   'Ultima Cena Juan de Juanes Prado',
  'nativity-correggio':           'Correggio Adoration of the Shepherds Holy Night Dresden',
  'nativity-la-tour':             'Georges de La Tour Adoration of the Shepherds Louvre',
  'presentation-byzantine-icon':  'Presentation of Christ in the Temple Hypapante icon',
  'presentation-rembrandt':       'Rembrandt Simeon Song of Praise Mauritshuis',
  'crucifixion-grunewald':        'Grunewald Isenheim Altarpiece Crucifixion panel',
  'resurrection-grunewald':       'Grunewald Isenheim Altarpiece Resurrection panel',
};

/* slugs to re-query in --fix mode (bad first-pass matches) */
const REDO = [
'assumption-poussin','coronation-fra-angelico','ecce-homo-ciseri','nativity-correggio',
'noli-me-tangere-fra-angelico','gethsemane-byzantine-icon','carrying-byzantine-icon',
'flagellation-byzantine-icon',
];

const SLUGS = [
'anastasis-byzantine-icon','annunciation-botticelli','annunciation-duccio','annunciation-fra-angelico',
'annunciation-ohrid-icon','annunciation-simone-martini','ascension-byzantine-icon','ascension-garofalo',
'ascension-giotto','ascension-mantegna','ascension-rembrandt','assumption-el-greco','assumption-murillo',
'assumption-poussin','assumption-titian','baptism-el-greco','baptism-perugino','baptism-piero',
'baptism-verrocchio','calling-peter-andrew-duccio','cana-byzantine-icon','cana-gerard-david','cana-giotto',
'cana-tintoretto','cana-veronese','carrying-bosch','carrying-byzantine-icon','carrying-duccio',
'carrying-el-greco','carrying-raphael-spasimo','christ-preaching-hundred-guilder',
'communion-of-the-apostles-fra-angelico','coronation-el-greco','coronation-fra-angelico',
'coronation-gentile-da-fabriano','coronation-martorana-mosaic','coronation-velazquez',
'crowning-byzantine-icon','crowning-thorns-bosch','crowning-thorns-caravaggio','crowning-thorns-titian',
'crucifixion-byzantine-icon','crucifixion-fra-angelico','crucifixion-grunewald','crucifixion-mantegna',
'crucifixion-velazquez','dormition-byzantine-icon','ecce-homo-ciseri','ecce-homo-guido-reni',
'emmaus-caravaggio','finding-byzantine-icon','finding-duccio','finding-durer','finding-hunt',
'finding-simone-martini','flagellation-bouguereau','flagellation-byzantine-icon','flagellation-caravaggio',
'flagellation-piero','flagellation-velazquez','gethsemane-bellini','gethsemane-byzantine-icon',
'gethsemane-el-greco','gethsemane-fra-angelico','gethsemane-mantegna','healing-paralytic-van-dyck',
'last-supper-duccio','last-supper-juan-de-juanes','last-supper-leonardo','mystical-supper-icon',
'nativity-botticelli','nativity-byzantine-icon','nativity-correggio','nativity-giotto','nativity-la-tour',
'noli-me-tangere-fra-angelico','pentecost-byzantine-icon','pentecost-duccio','pentecost-el-greco',
'pentecost-giotto','pentecost-restout','presentation-byzantine-icon','presentation-fra-angelico',
'presentation-lorenzetti','presentation-mantegna','presentation-rembrandt','resurrection-grunewald',
'resurrection-piero','sermon-on-the-mount-fra-angelico','sower-millet','theophany-byzantine-icon',
'transfiguration-bellini','transfiguration-duccio','transfiguration-fra-angelico','transfiguration-raphael',
'transfiguration-theophanes-icon','visitation-eastern-icon','visitation-ghirlandaio','visitation-giotto',
'visitation-pontormo','visitation-van-der-weyden'
];

const dry = process.argv.includes('--dry');
const fix = process.argv.includes('--fix');
const singleSlug = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const exactFile  = process.argv[3] || null;

const q = s => OVERRIDES[s] || s.replace(/-/g,' ')
  .replace('byzantine icon','icon').replace(/\b(el greco|la tour)\b/g, m=>m);

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function api(params){
  const u = new URL(API);
  Object.entries({format:'json', origin:'*', ...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  for (let attempt=1; attempt<=4; attempt++){
    const r = await fetch(u, {headers:{'User-Agent':'still-app-rosary-sourcing/1.0 (stillprayer.app)'}});
    const text = await r.text();
    try { return JSON.parse(text); }
    catch {
      // Commons throttled us with an HTML/text page — back off and retry
      const wait = attempt * 15000;
      console.log(`   …rate limited, waiting ${wait/1000}s (attempt ${attempt}/4)`);
      await sleep(wait);
    }
  }
  throw new Error('rate limited after 4 attempts — wait a few minutes and re-run');
}

async function findImage(slug){
  const forced = (exactFile && singleSlug===slug) ? exactFile : FORCE[slug];
  if (forced){
    const j = await api({action:'query', titles:forced, prop:'imageinfo', iiprop:'url', iiurlwidth:WIDTH});
    const p = Object.values(j.query.pages)[0];
    return {title:forced, url:p?.imageinfo?.[0]?.thumburl};
  }
  if (false){
    const j = await api({action:'query', titles:exactFile, prop:'imageinfo', iiprop:'url', iiurlwidth:WIDTH});
    const p = Object.values(j.query.pages)[0];
    return {title:exactFile, url:p?.imageinfo?.[0]?.thumburl};
  }
  const j = await api({
    action:'query', generator:'search', gsrsearch:`${q(slug)} filetype:bitmap`,
    gsrnamespace:6, gsrlimit:5, prop:'imageinfo', iiprop:'url|size', iiurlwidth:WIDTH
  });
  const pages = Object.values(j.query?.pages||{}).sort((a,b)=>a.index-b.index);
  // prefer results with decent resolution
  const best = pages.find(p=>p.imageinfo?.[0]?.width>=800) || pages[0];
  return best ? {title:best.title, url:best.imageinfo[0].thumburl} : null;
}

async function main(){
  if (!dry) await mkdir(OUT, {recursive:true});
  const targets = singleSlug ? [singleSlug] : (fix ? REDO : SLUGS);
  const report = existsSync('rosary-image-report.json')
    ? JSON.parse(await readFile('rosary-image-report.json','utf8')) : {};

  for (const slug of targets){
    const dest = `${OUT}/${slug}.jpg`;
    if (!singleSlug && !fix && existsSync(dest)) { console.log(`✓ have  ${slug}`); continue; }
    if (!singleSlug && !fix && dry && report[slug]?.file) { console.log(`✓ matched  ${slug}`); continue; }
    try {
      const m = await findImage(slug);
      if (!m?.url){ console.log(`✗ MISS  ${slug}  (query: "${q(slug)}")`); report[slug]={miss:true, query:q(slug)}; continue; }
      console.log(`→ ${slug}\n     ${m.title}`);
      report[slug] = {file:m.title, query:q(slug)};
      if (!dry){
        let saved = false;
        for (let attempt=1; attempt<=4 && !saved; attempt++){
          const buf = Buffer.from(await (await fetch(m.url,{headers:{'User-Agent':'still-app-rosary-sourcing/1.0 (stillprayer.app)'}})).arrayBuffer());
          // real images start with JPEG (FF D8), PNG (89 50), or are >20KB; throttle pages are ~2KB text
          const looksReal = (buf[0]===0xFF && buf[1]===0xD8) || (buf[0]===0x89 && buf[1]===0x50) || buf.length>20000;
          if (looksReal){ await writeFile(dest, buf); saved = true; }
          else {
            const wait = attempt*15000;
            console.log(`   …got a throttle page instead of the image, waiting ${wait/1000}s (attempt ${attempt}/4)`);
            await sleep(wait);
          }
        }
        if (!saved){ console.log(`✗ THROTTLED ${slug} — re-run later`); report[slug].throttled = true; }
      }
      await sleep(2000);   // be polite to Commons — they throttled us at 400ms
    } catch(e){ console.log(`✗ ERR   ${slug}: ${e.message}`); report[slug]={error:e.message}; }
  }
  await writeFile('rosary-image-report.json', JSON.stringify(report,null,2));
  console.log('\nReport written to rosary-image-report.json — spot-check the matches,');
  console.log('then re-run any wrong ones with: node fetch-rosary-images.mjs <slug> "File:Exact Name.jpg"');
}
main();
