/**
 * SingTheHours — Still Prayer App Integration
 * ============================================
 * Fetches the Sing the Hours RSS feed (via the rss-proxy Netlify function),
 * parses today's episodes, and matches each one to the correct Office hour:
 *   Lauds    → morning prayer (around 6 AM)
 *   Vespers  → evening prayer (around 6 PM)
 *   Compline → night prayer   (around 9 PM)
 *
 * Usage inside index.html:
 *   <script src="sing-the-hours.js"></script>
 *   ...
 *   const ep = await SingTheHours.getForHour('lauds');
 *   if (ep) SingTheHours.mountPlayer(ep, document.getElementById('office-audio-slot'));
 *
 * Public API:
 *   SingTheHours.getForHour(hour)          → Promise<Episode|null>
 *   SingTheHours.getTodayEpisodes()        → Promise<Episode[]>
 *   SingTheHours.mountPlayer(ep, el)       → void   (injects audio UI)
 *   SingTheHours.unmountPlayer(el)         → void
 */

window.SingTheHours = (function () {
  "use strict";

  // ─── Config ──────────────────────────────────────────────────────────────

  const PROXY_URL = "/.netlify/functions/rss-proxy";
  const CACHE_KEY = "sth_feed_cache";
  const CACHE_TTL_MS = 30 * 60 * 1000;

  // Maps canonical hour names → keywords we look for in episode titles
  const HOUR_KEYWORDS = {
    lauds:    ["lauds", "morning prayer", "morning office"],
    vespers:  ["vespers", "evening prayer", "evening office"],
    compline: ["compline", "night prayer", "night office", "night prayer"],
  };

  // ─── Types ───────────────────────────────────────────────────────────────
  /**
   * @typedef {Object} Episode
   * @property {string} title         — Full episode title
   * @property {string} hour          — 'lauds' | 'vespers' | 'compline'
   * @property {string} audioUrl      — Direct MP3/M4A URL from <enclosure>
   * @property {string} description   — Stripped episode description
   * @property {Date}   pubDate       — Publication date
   * @property {string} duration      — e.g. "00:14:32"
   * @property {string} episodeUrl    — Link to episode page (optional)
   */

  // ─── Feed Fetching ────────────────────────────────────────────────────────

  async function fetchFeed() {
    // Try sessionStorage cache first
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { xml, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) return xml;
      }
    } catch (_) { /* ignore */ }

    const res = await fetch((window.FN_BASE || '') + PROXY_URL);
    if (!res.ok) throw new Error(`rss-proxy returned ${res.status}`);
    const xml = await res.text();

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ xml, ts: Date.now() }));
    } catch (_) { /* ignore quota errors */ }

    return xml;
  }

  // ─── XML Parsing ──────────────────────────────────────────────────────────

  function parseFeed(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    if (doc.querySelector("parsererror")) {
      throw new Error("RSS feed could not be parsed");
    }

    const items = Array.from(doc.querySelectorAll("item"));
    return items.map(parseItem).filter(Boolean);
  }

  function parseItem(item) {
    const title       = text(item, "title");
    const pubDateStr  = text(item, "pubDate");
    const description = stripHtml(text(item, "description") || text(item, "summary") || "");
    const enclosure   = item.querySelector("enclosure");
    const link        = text(item, "link");
    const duration    = text(item, "itunes\\:duration") ||
                        text(item, "duration") || "";

    if (!enclosure) return null;

    const audioUrl = enclosure.getAttribute("url");
    if (!audioUrl) return null;

    const pubDate = pubDateStr ? new Date(pubDateStr) : null;

    const hour = detectHour(title);
    if (!hour) return null; // Not a Lauds/Vespers/Compline episode

    return { title, hour, audioUrl, description, pubDate, duration, episodeUrl: link };
  }

  // ─── Hour Detection ───────────────────────────────────────────────────────

  function detectHour(title) {
    const t = (title || "").toLowerCase();
    for (const [hour, keywords] of Object.entries(HOUR_KEYWORDS)) {
      if (keywords.some(kw => t.includes(kw))) return hour;
    }
    return null;
  }

  // ─── Date Matching ────────────────────────────────────────────────────────

  function isToday(date) {
    if (!date || isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth()    === now.getMonth()    &&
      date.getDate()     === now.getDate()
    );
  }

  /**
   * Returns the most recent episode for a given hour that is either:
   * 1. Published today, OR
   * 2. The most recent one in the feed (as a graceful fallback)
   */
  function bestEpisodeForHour(episodes, hour) {
    const forHour = episodes.filter(ep => ep.hour === hour);
    if (!forHour.length) return null;

    const todaysEp = forHour.find(ep => isToday(ep.pubDate));
    if (todaysEp) return todaysEp;

    // Fallback: most recent
    return forHour.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))[0];
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns today's episode for a given Office hour.
   * @param {'lauds'|'vespers'|'compline'} hour
   * @returns {Promise<Episode|null>}
   */
  async function getForHour(hour) {
    const normalised = hour.toLowerCase().trim();
    try {
      const xml = await fetchFeed();
      const episodes = parseFeed(xml);
      return bestEpisodeForHour(episodes, normalised);
    } catch (err) {
      console.error("[SingTheHours] getForHour failed:", err);
      return null;
    }
  }

  /**
   * Returns all of today's recognisable episodes.
   * @returns {Promise<Episode[]>}
   */
  async function getTodayEpisodes() {
    try {
      const xml = await fetchFeed();
      const episodes = parseFeed(xml);
      const today = episodes.filter(ep => isToday(ep.pubDate));
      // If no today episodes at all, return the most recent of each hour
      if (!today.length) {
        return Object.keys(HOUR_KEYWORDS)
          .map(h => bestEpisodeForHour(episodes, h))
          .filter(Boolean);
      }
      return today;
    } catch (err) {
      console.error("[SingTheHours] getTodayEpisodes failed:", err);
      return [];
    }
  }

  // ─── Audio Player UI ──────────────────────────────────────────────────────

  const HOUR_LABELS = {
    lauds:    { label: "Morning Prayer", icon: "☀️" },
    vespers:  { label: "Evening Prayer", icon: "🌅" },
    compline: { label: "Night Prayer",   icon: "🌙" },
  };

  /**
   * Injects a Sing the Hours audio player card into the given container element.
   * Matches Still's design language (Playfair Display, DM Sans, DM Mono,
   * Still Green #1D9E75, Night #090818).
   *
   * @param {Episode} episode
   * @param {HTMLElement} container — where to mount the card
   */
  function mountPlayer(episode, container) {
    if (!container) return;
    unmountPlayer(container);

    const { label, icon } = HOUR_LABELS[episode.hour] || { label: "Prayer", icon: "🎵" };
    const isTodays = isToday(episode.pubDate);
    const dateLabel = episode.pubDate
      ? episode.pubDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : "";

    const card = document.createElement("div");
    card.className = "sth-player";
    card.setAttribute("data-sth", "true");
    card.innerHTML = `
      <style>
        .sth-player {
          margin: 1.5rem 0;
          background: rgba(29, 158, 117, 0.07);
          border: 1px solid rgba(29, 158, 117, 0.25);
          border-radius: 16px;
          padding: 1.25rem 1.5rem 1rem;
          font-family: 'DM Sans', sans-serif;
        }
        .sth-eyebrow {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1D9E75;
          margin-bottom: 0.65rem;
        }
        .sth-eyebrow-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #1D9E75;
          flex-shrink: 0;
        }
        .sth-title {
          font-family: 'Playfair Display', serif;
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.35;
          color: #fff;
          margin-bottom: 0.2rem;
        }
        .sth-meta {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.4);
          margin-bottom: 1rem;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.04em;
        }
        .sth-audio {
          width: 100%;
          height: 36px;
          border-radius: 8px;
          accent-color: #1D9E75;
          outline: none;
        }
        .sth-audio::-webkit-media-controls-panel {
          background: rgba(29, 158, 117, 0.1);
        }
        .sth-not-today {
          margin-top: 0.75rem;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.35);
          font-family: 'DM Mono', monospace;
          text-align: center;
          letter-spacing: 0.04em;
        }
      </style>
      <div class="sth-eyebrow">
        <span class="sth-eyebrow-dot"></span>
        Sing the Hours · ${icon} ${label}
      </div>
      <div class="sth-title">${escapeHtml(episode.title)}</div>
      ${dateLabel ? `<div class="sth-meta">${escapeHtml(dateLabel)}${episode.duration ? " · " + episode.duration : ""}</div>` : ""}
      <audio
        class="sth-audio"
        src="${escapeHtml(episode.audioUrl)}"
        controls
        preload="none"
        aria-label="${escapeHtml(label)} — ${escapeHtml(episode.title)}"
      ></audio>
      ${!isTodays ? '<div class="sth-not-today">Most recent episode · Today\'s not yet published</div>' : ""}
    `;

    container.appendChild(card);
  }

  /** Removes a previously mounted player from the container. */
  function unmountPlayer(container) {
    if (!container) return;
    const existing = container.querySelector("[data-sth]");
    if (existing) existing.remove();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function text(el, selector) {
    const found = el.querySelector(selector);
    return found ? (found.textContent || "").trim() : "";
  }

  function stripHtml(str) {
    return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Exports ─────────────────────────────────────────────────────────────

  return { getForHour, getTodayEpisodes, mountPlayer, unmountPlayer };
})();