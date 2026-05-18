/**
 * Netlify Function: rss-proxy
 * Proxies the Sing the Hours RSS feed to avoid CORS issues in the browser.
 * Caches the feed for 30 minutes using a module-level variable (per warm instance).
 *
 * Deploy: this file lives at netlify/functions/rss-proxy.js
 * Endpoint: /.netlify/functions/rss-proxy
 *   OR (if you've added a redirect in netlify.toml): /api/sing-the-hours
 */

const FEED_URL = "https://singthehours.castos.com/feed/podcast";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Module-level cache (persists across warm lambda invocations)
let cache = { xml: null, fetchedAt: 0 };

exports.handler = async function (event, context) {
  const now = Date.now();

  // Serve from cache if fresh
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

    if (!response.ok) {
      throw new Error(`Feed responded with ${response.status}`);
    }

    const xml = await response.text();
    cache = { xml, fetchedAt: now };
    return respond(200, xml);
  } catch (err) {
    console.error("rss-proxy error:", err);
    // If we have stale cache, return it rather than fail entirely
    if (cache.xml) {
      return respond(200, cache.xml, true);
    }
    return respond(502, `<?xml version="1.0"?><error>${err.message}</error>`);
  }
};

function respond(statusCode, body, stale = false) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": stale
        ? "stale-while-revalidate=3600"
        : "public, max-age=1800",
      "X-Cache": stale ? "STALE" : "FRESH",
    },
    body,
  };
}