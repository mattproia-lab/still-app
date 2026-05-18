/* ═══════════════════════════════════════════════════════════
   MONASTERY BELLS — bells.js
   Add this to your main <script> block in index.html,
   or load as <script src="/still-mobile/bells.js"></script>
════════════════════════════════════════════════════════════ */

// ─── Constants ────────────────────────────────────────────────────────────

const BELLS_STORAGE_KEY = 'still_bells_v1';
const BELLS_USER_KEY    = 'still_bells_userid';

const BELL_DEFAULTS = {
  vigils:   { enabled: false, time: '03:00' },
  lauds:    { enabled: false, time: '06:00' },
  vespers:  { enabled: false, time: '18:00' },
  compline: { enabled: false, time: '21:00' },
};

// ─── State ────────────────────────────────────────────────────────────────

function getBellSettings() {
  try {
    const raw = localStorage.getItem(BELLS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(BELL_DEFAULTS));
  } catch { return JSON.parse(JSON.stringify(BELL_DEFAULTS)); }
}

function saveBellSettingsLocal(settings) {
  localStorage.setItem(BELLS_STORAGE_KEY, JSON.stringify(settings));
}

// Get or create a stable anonymous user ID for OneSignal targeting
function getBellUserId() {
  let id = localStorage.getItem(BELLS_USER_KEY);
  if (!id) {
    id = 'still-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(BELLS_USER_KEY, id);
  }
  return id;
}

// ─── UI: initialise on settings open ─────────────────────────────────────

function initBellSettings() {
  const settings = getBellSettings();

  for (const [hour, config] of Object.entries(settings)) {
    const toggle = document.querySelector(`.bell-toggle[data-hour="${hour}"]`);
    const timeInput = document.querySelector(`.bell-time[data-hour="${hour}"]`);
    const row = document.querySelector(`.bell-row[data-hour="${hour}"]`);
    if (!toggle || !timeInput) continue;

    timeInput.value = config.time;

    if (config.enabled) {
      _setBellToggleOn(toggle, timeInput, row);
    } else {
      _setBellToggleOff(toggle, timeInput, row);
    }

    // Listen for time changes
    timeInput.addEventListener('change', () => {
      document.getElementById('bellsSaveBtn').style.display = 'block';
      document.getElementById('bellsSavedMsg').style.display = 'none';
    });
  }
}

// ─── UI: toggle ───────────────────────────────────────────────────────────

function toggleBell(hour, btn) {
  const timeInput = document.querySelector(`.bell-time[data-hour="${hour}"]`);
  const row = document.querySelector(`.bell-row[data-hour="${hour}"]`);
  const isOn = btn.getAttribute('aria-pressed') === 'true';

  if (isOn) {
    _setBellToggleOff(btn, timeInput, row);
  } else {
    _setBellToggleOn(btn, timeInput, row);
  }

  document.getElementById('bellsSaveBtn').style.display = 'block';
  document.getElementById('bellsSavedMsg').style.display = 'none';
}

function _setBellToggleOn(btn, timeInput, row) {
  btn.setAttribute('aria-pressed', 'true');
  btn.style.background = 'rgba(200,146,12,.55)';
  btn.querySelector('span').style.transform = 'translateX(18px)';
  timeInput.style.display = 'block';
  if (row) row.style.borderColor = 'rgba(200,146,12,.3)';
}

function _setBellToggleOff(btn, timeInput, row) {
  btn.setAttribute('aria-pressed', 'false');
  btn.style.background = 'rgba(255,255,255,.1)';
  btn.querySelector('span').style.transform = 'translateX(0)';
  timeInput.style.display = 'none';
  if (row) row.style.borderColor = 'rgba(255,255,255,.07)';
}

// ─── Save & schedule ─────────────────────────────────────────────────────

async function saveBellSettings() {
  const btn = document.getElementById('bellsSaveBtn');
  const msg = document.getElementById('bellsSavedMsg');

  btn.textContent = 'Saving…';
  btn.style.opacity = '0.6';
  btn.disabled = true;

  const settings = {};
  for (const hour of ['vigils', 'lauds', 'vespers', 'compline']) {
    const toggle = document.querySelector(`.bell-toggle[data-hour="${hour}"]`);
    const timeInput = document.querySelector(`.bell-time[data-hour="${hour}"]`);
    settings[hour] = {
      enabled: toggle ? toggle.getAttribute('aria-pressed') === 'true' : false,
      time: timeInput ? timeInput.value : BELL_DEFAULTS[hour].time,
    };
  }

  // Save locally first (works even if network fails)
  saveBellSettingsLocal(settings);

  // Request notification permission if any bell is enabled
  const anyEnabled = Object.values(settings).some(s => s.enabled);
  if (anyEnabled) {
    await _requestNotificationPermission();
  }

  // Register external user ID with OneSignal so we can target this device
  const userId = getBellUserId();
  if (window.OneSignal) {
    try {
      await OneSignal.login(userId);
    } catch (e) {
      console.warn('[Bells] OneSignal login failed:', e);
    }
  }

  // Schedule via Netlify function
  try {
    const res = await fetch('/.netlify/functions/schedule-bells', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, bells: settings }),
    });
    const data = await res.json();
    console.log('[Bells] Schedule result:', data);
  } catch (err) {
    console.warn('[Bells] Could not reach schedule-bells function:', err);
  }

  btn.style.display = 'none';
  btn.style.opacity = '1';
  btn.disabled = false;
  btn.textContent = 'Save Bell Schedule';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

// ─── Notification permission ──────────────────────────────────────────────

async function _requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission === 'denied') return;
  try {
    if (window.OneSignal) {
      await OneSignal.Notifications.requestPermission();
    } else {
      await Notification.requestPermission();
    }
  } catch (e) {
    console.warn('[Bells] Notification permission request failed:', e);
  }
}

// ─── Play bell locally (when app is open) ────────────────────────────────

let _bellAudio = null;

function playBell() {
  try {
    if (!_bellAudio) {
      _bellAudio = new Audio('/assets/bell.mp3');
      _bellAudio.volume = 0.8;
    }
    _bellAudio.currentTime = 0;
    _bellAudio.play().catch(() => {});
  } catch (e) {
    console.warn('[Bells] Could not play bell:', e);
  }
}

// Check on load if right now matches any enabled bell time (±1 min)
function checkBellsOnLoad() {
  const settings = getBellSettings();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const current = `${hh}:${mm}`;

  for (const [hour, config] of Object.entries(settings)) {
    if (!config.enabled) continue;
    // Match within a 1-minute window
    if (config.time === current ||
        config.time === _offsetTime(current, -1)) {
      playBell();
      break;
    }
  }
}

function _offsetTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
}

// Poll every minute when app is open
setInterval(checkBellsOnLoad, 60000);
// Also check immediately on load
document.addEventListener('DOMContentLoaded', checkBellsOnLoad);