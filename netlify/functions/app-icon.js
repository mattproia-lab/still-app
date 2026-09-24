// netlify/functions/app-icon.js
// Looks up apps on the App Store for the /keep page.
//   ?term=notion  -> up to 4 matches
//   ?id=123456789 -> one app by App Store id (used when a shared link is opened)
// Icons come back as data URLs so the page can draw them onto the share card
// without the canvas being blocked by cross-origin rules.

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=86400",
  // Let Netlify's CDN reuse answers so repeat searches don't hit Apple's rate limit.
  "Netlify-CDN-Cache-Control": "public, durable, max-age=86400",
};

async function toDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  let url;

  if (q.id && /^\d{5,12}$/.test(q.id)) {
    url = `https://itunes.apple.com/lookup?id=${q.id}&entity=software&country=us`;
  } else if (q.term && q.term.trim().length >= 2 && q.term.length <= 40) {
    url = `https://itunes.apple.com/search?term=${encodeURIComponent(q.term.trim())}&entity=software&country=us&limit=4`;
  } else {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ results: [] }) };
  }

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`App Store returned ${r.status}`);
    const data = await r.json();
    const apps = (data.results || [])
      .filter((a) => a.trackId && (a.artworkUrl512 || a.artworkUrl100))
      .slice(0, 4);

    const results = await Promise.all(
      apps.map(async (a) => {
        const art = (a.artworkUrl512 || a.artworkUrl100).replace(
          /\/\d+x\d+bb\.(jpg|png|webp)$/,
          "/256x256bb.jpg"
        );
        return { id: String(a.trackId), name: a.trackName, icon: await toDataUrl(art) };
      })
    );

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ results }) };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ results: [] }),
    };
  }
};
