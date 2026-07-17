const FEED_URL = "https://singthehours.castos.com/feed";
const CACHE_TTL_MS = 30 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

let cache = { xml: null, fetchedAt: 0 };

exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const now = Date.now();

  if (cache.xml && now - cache.fetchedAt < CACHE_TTL_MS) {
    return respond(200, cache.xml);
  }

  try {
    const response = await fetch(FEED_URL, {
      headers: {
        "User-Agent": "StillPrayerApp/1.0 (+https://stillprayer.app)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) throw new Error(`Feed responded with ${response.status}`);

    const xml = await response.text();
    cache = { xml, fetchedAt: now };
    return respond(200, xml);
  } catch (err) {
    console.error("rss-proxy error:", err);
    if (cache.xml) return respond(200, cache.xml, true);
    return respond(502, `<?xml version="1.0"?><error>${err.message}</error>`);
  }
};

function respond(statusCode, body, stale = false) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...CORS,
      "Cache-Control": stale ? "stale-while-revalidate=3600" : "public, max-age=1800",
      "X-Cache": stale ? "STALE" : "FRESH",
    },
    body,
  };
}