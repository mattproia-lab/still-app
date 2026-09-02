/*
 * bell-native.js — Still
 * ----------------------------------------------------------------------------
 * Schedules on-device local notifications (the monastery bell) for the
 * Liturgy of the Hours — and the user's own custom bells — when Still runs
 * as a NATIVE iOS/Android build.
 *
 * This is now the ONLY delivery path for bells. The four Netlify functions
 * that used to push through OneSignal are stubs: the OneSignal web SDK was
 * removed in 2391f30 and nothing replaced it, so those pushes reached nobody.
 *
 * IDs: 1-4 the four Hours (vigils/lauds/vespers/compline), 5-7 custom slots.
 * Launch path only ever ARMS (never cancels, never prompts); cancelling and
 * permission prompting belong to the explicit Save action.
 * ----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var HOUR_IDS = { vigils: 1, lauds: 2, vespers: 3, compline: 4 };
  var CUSTOM_BASE_ID = 4; // slot N -> id 4+N (5,6,7)
  var ALL_IDS = [1, 2, 3, 4, 5, 6, 7];

  /* Four bells + three custom slots, each a REPEATING daily schedule, so the
     whole system costs 7 of iOS's 64 pending notifications and never expires.

     It is deliberately not a queue of dated notifications refilled on open.
     That model would cost one slot per bell per day -- 64 slots buys about 16
     days -- and index.html's Desert Fathers series is sized against this:
     "TARGET = 30 // weeks kept queued (bells 1-4 + 30 = well under iOS's 64)".
     Bells taking 64 would put the device at 94 pending, and iOS keeps the 64
     soonest and silently drops the rest. */
  var EXPECTED_MIN = 1;   // re-arm if fewer bells are pending than we scheduled

  var FALLBACK_TIMES = {
    vigils:   { hour: 4,  minute: 0 },
    lauds:    { hour: 6,  minute: 0 },
    vespers:  { hour: 18, minute: 0 },
    compline: { hour: 21, minute: 0 }
  };

  var TITLES = {
    vigils: 'Vigils', lauds: 'Lauds', vespers: 'Vespers', compline: 'Compline'
  };
  var BODY = 'The monastery bell tolls. Come to the Office.';
  var CUSTOM_BODY = 'The monastery bell tolls.';
  /* Lauds is the morning bell, so it is the one that carries the fast. Vigils is
     night; Vespers and Compline are evening, and by then the intention has
     either been kept or not -- a reminder there would be a reproach. */
  var FAST_BODY = 'The monastery bell tolls. Come to the Office — and offer today’s fast with it.';

  /* ── Fasting Mode: the midday reflection ────────────────────────────────
     IDs 8001-8014, clear of the Hours (1-4), the custom slots (5-7), the
     Desert Fathers series (9001-9899) and its test (8999). ALL_IDS does not
     include them, so the bell Save path never cancels these -- they have their
     own lifecycle, tied to the fasting toggle.

     A repeating daily notification carries ONE fixed body forever, so a
     rotating text has to be a queue of dated notifications, topped up on
     launch. Same shape as the Desert Fathers series in index.html, and costed
     against the same budget: 4 bells + 3 custom + 30 quotes + 14 fasting = 51
     of iOS's 64 pending. */
  var FAST_ID_MIN = 8001, FAST_DAYS = 14;
  var FAST_HOUR = 12;                       // noon, local

  function isFasting() {
    try { return localStorage.getItem('still_fasting') === '1'; }
    catch (e) { return false; }
  }

  function fastIds() {
    var out = [];
    for (var i = 0; i < FAST_DAYS; i++) out.push({ id: FAST_ID_MIN + i });
    return out;
  }

  /* Scripture is Douay-Rheims, the same translation as the Lectio passages in
     index.html -- Isaiah and Joel are quoted from those entries verbatim.
     Bodies stay short: iOS truncates near 110 characters on the lock screen. */
  var FAST_TEXTS = [
    { t: 'Isaiah 58',            b: 'Is not this rather the fast that I have chosen? Deal thy bread to the hungry.' },
    { t: 'Isaiah 58',            b: 'Loose the bands of wickedness, undo the bundles that oppress, let them that are broken go free.' },
    { t: 'Joel 2',               b: 'Be converted to me with all your heart, in fasting, and in weeping, and mourning.' },
    { t: 'Matthew 6',            b: 'When thou fastest, anoint thy head, and wash thy face; that thou appear not to men to fast.' },
    { t: 'Tertullian',           b: 'Fasting is the soul of prayer, mercy is the lifegiving fasting. If you pray, fast; if you fast, show mercy.' },
    { t: 'St John Chrysostom',   b: 'He who fasts is light of foot and runs toward God; he who does not fast is heavy and falls to the earth.' },
    { t: 'St John Chrysostom',   b: 'Fasting is a medicine — but a medicine that becomes useless through the unskilfulness of him who employs it.' },
    { t: 'St Peter Chrysologus', b: 'Prayer knocks, fasting obtains, mercy receives.' },
    { t: 'St Basil the Great',   b: 'Take heed lest, having fasted from food, you devour your brother.' },
    { t: 'St Thomas Aquinas',    b: 'Fasting is practised to bridle the lusts of the flesh, that the mind may rise more freely.' },
    { t: 'Abba Moses',           b: 'Fasting without prayer is hunger. Prayer without fasting is distraction.' },
    { t: 'Abba Moses',           b: 'The fast is not of the belly alone. Fast with the eyes, the tongue, the temper — or you have not fasted.' }
  ];

  // Stable per-day pick: the same calendar day always draws the same text, so a
  // top-up that re-queues an already-scheduled day does not change it.
  function fastTextFor(date) {
    var day = Math.floor(date.getTime() / 86400000);
    return FAST_TEXTS[((day % FAST_TEXTS.length) + FAST_TEXTS.length) % FAST_TEXTS.length];
  }

  function selectedVoice() {
    try { return localStorage.getItem('still_bell_voice') || 'bell-call.wav'; }
    catch (e) { return 'bell-call.wav'; }
  }

  /* A notification sound is a NATIVE asset, not a web one. The four voices in
     assets/ are served to the WebView and cannot be used here.

     iOS  -- must be a file in the app bundle root. Exactly one is bundled:
             bell.wav (22.1s, 44.1kHz stereo -- inside the 30s limit). Per-voice
             selection on iOS needs the other three added to the bundle first.

             KNOWN GAP: bell.wav is present at ios/App/App/bell.wav but is NOT
             in the Xcode project -- project.pbxproj references no audio file at
             all, so it is never copied into the bundle. Until it is added to
             Copy Bundle Resources, iOS falls back to the default sound. This
             field is set so it starts working the moment that is fixed.

     Android -- must be in res/raw, referenced WITHOUT extension.
             KNOWN GAP: android/app/src/main/res/raw/ does not exist yet, so
             Android also falls back to the default until the wavs are copied
             there. */
  function bellSound() {
    var platform = '';
    try { platform = Capacitor.getPlatform ? Capacitor.getPlatform() : ''; } catch (e) {}
    if (platform === 'ios') return selectedVoice();
    return selectedVoice().replace(/\.wav$/i, '');
  }

  function customSound(voice) {
    var platform = '';
    try { platform = Capacitor.getPlatform ? Capacitor.getPlatform() : ''; } catch (e) {}
    var v = String(voice || 'bell-call.wav');
    if (platform === 'ios') return v;
    return v.replace(/\.wav$/i, '');
  }

  function isNative() {
    return !!(window.Capacitor &&
              typeof Capacitor.isNativePlatform === 'function' &&
              Capacitor.isNativePlatform() &&
              Capacitor.Plugins &&
              Capacitor.Plugins.LocalNotifications);
  }

  function plugin() {
    return Capacitor.Plugins.LocalNotifications;
  }

  function parseTime(text) {
    if (!text) return null;
    var m = text.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/);
    if (!m) return null;
    var hour = parseInt(m[1], 10);
    var minute = parseInt(m[2], 10);
    var pm = /[Pp][Mm]/.test(m[3]);
    if (hour === 12) hour = 0;
    if (pm) hour += 12;
    return { hour: hour, minute: minute };
  }

  function readHourSchedule() {
    var rows = document.querySelectorAll('.bell-row');
    var schedule = [];
    rows.forEach(function (row) {
      var hour = row.getAttribute('data-hour');
      if (!hour || !HOUR_IDS[hour]) return;

      var toggle = row.querySelector('.bell-toggle');
      var on = !!toggle && toggle.getAttribute('aria-pressed') === 'true';

      var time = null;
      var divs = row.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var t = parseTime((divs[i].textContent || '').trim());
        if (t) { time = t; break; }
      }
      if (!time) time = FALLBACK_TIMES[hour];

      schedule.push({ hour: hour, on: on, time: time });
    });
    return schedule;
  }

  function readCustomSchedule() {
    var rows = document.querySelectorAll('.custom-bell-row');
    var out = [];
    rows.forEach(function (row) {
      var slot = parseInt(row.getAttribute('data-slot'), 10);
      if (!slot || slot < 1 || slot > 3) return;
      var toggle = row.querySelector('.custom-bell-toggle');
      var on = !!toggle && toggle.getAttribute('aria-pressed') === 'true';
      var timeVal = (row.querySelector('.custom-bell-time') || {}).value || '';
      var tm = timeVal.match(/^(\d{1,2}):(\d{2})/);
      var label = ((row.querySelector('.custom-bell-label') || {}).value || '').trim() || 'Prayer';
      var voice = (row.querySelector('.custom-bell-voice') || {}).value || 'bell-call.wav';
      if (!tm) return;
      out.push({
        slot: slot,
        on: on,
        time: { hour: parseInt(tm[1], 10), minute: parseInt(tm[2], 10) },
        label: label,
        voice: voice
      });
    });
    return out;
  }

  function buildNotifications() {
    var sound = bellSound();
    var list = readHourSchedule()
      .filter(function (s) { return s.on; })
      .map(function (s) {
        return {
          id: HOUR_IDS[s.hour],
          title: TITLES[s.hour],
          body: (s.hour === 'lauds' && isFasting()) ? FAST_BODY : BODY,
          sound: sound,
          schedule: {
            on: { hour: s.time.hour, minute: s.time.minute },
            allowWhileIdle: true
          }
        };
      });

    readCustomSchedule()
      .filter(function (c) { return c.on; })
      .forEach(function (c) {
        list.push({
          id: CUSTOM_BASE_ID + c.slot,
          title: c.label,
          body: CUSTOM_BODY,
          sound: customSound(c.voice),
          schedule: {
            on: { hour: c.time.hour, minute: c.time.minute },
            allowWhileIdle: true
          }
        });
      });

    return list;
  }

  function showBellToast(msg) {
    try {
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);left:50%;transform:translateX(-50%);z-index:99999;background:rgba(20,18,10,.95);border:1px solid rgba(200,146,12,.5);color:#f0c040;font-family:Heebo,sans-serif;font-size:13px;padding:10px 18px;border-radius:20px;max-width:80vw;text-align:center';
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3500);
    } catch (e) {}
  }

  async function verifyPending(showToast) {
    try {
      var LN = plugin();
      var pending = await LN.getPending();
      var bells = (pending.notifications || []).filter(function (n) {
        return ALL_IDS.indexOf(n.id) !== -1;
      });
      console.log('[bell-native] pending bells: ' + bells.length);
      if (showToast) {
        showBellToast(bells.length > 0
          ? 'The bells are set — ' + bells.length + ' scheduled.'
          : 'No bells scheduled — check your toggles and try again.');
      }
      return bells.length;
    } catch (e) {
      console.warn('[bell-native] verify failed', e);
      if (showToast) showBellToast('Could not confirm the bell schedule.');
      return -1;
    }
  }

  async function ensurePermission() {
    var LN = plugin();
    var perm = await LN.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LN.requestPermissions();
    }
    return perm.display === 'granted';
  }

  /* SAVE path: authoritative, and the ONLY path that may prompt for
     permission -- the user has just asked for bells, so a prompt is expected
     here and nowhere else.

     Silent no-op off native: local notifications need the Capacitor plugin,
     which the browser does not have. No error, no message. */
  async function scheduleBells() {
    if (!isNative()) return;                      // web: silent skip
    var LN = plugin();
    try {
      if (!(await ensurePermission())) {
        showBellToast('Notifications are off for Still — enable them in iPhone Settings to hear the bells.');
        return;
      }

      var toSchedule = buildNotifications();

      await LN.cancel({
        notifications: ALL_IDS.map(function (id) { return { id: id }; })
      });

      if (toSchedule.length) {
        await LN.schedule({ notifications: toSchedule });
        try { localStorage.setItem('bellsScheduled', '1'); } catch (e) {}
        try { localStorage.setItem('bellsCount', String(toSchedule.length)); } catch (e) {}
      } else {
        try { localStorage.removeItem('bellsScheduled'); } catch (e) {}
        try { localStorage.removeItem('bellsCount'); } catch (e) {}
      }

      await verifyPending(true);
    } catch (e) {
      console.warn('[bell-native] schedule failed', e);
      showBellToast('Could not set the bells — please try again.');
    }
  }

  /* LAUNCH path: protective and silent. NEVER cancels, NEVER prompts.

     iOS drops pending notifications on reinstall, restore, and occasionally on
     OS update, so a user with bells enabled can quietly end up with none. This
     compares what the OS actually holds against what the toggles say should be
     there, and re-arms only when the OS is short.

     Permission is checked, never requested: a silent background reschedule
     must not raise a system prompt out of nowhere. If permission was revoked,
     it gives up and waits for the user to visit Settings and press Save. */
  async function checkAndRescheduleBells() {
    if (!isNative()) return;                      // web: silent skip
    var LN = plugin();
    try {
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') return;     // check only -- no prompt

      var toSchedule = buildNotifications();
      if (!toSchedule.length) return;

      var pendingCount = await verifyPending(false);
      if (pendingCount < 0) return;               // could not read the list
      if (pendingCount >= Math.max(EXPECTED_MIN, toSchedule.length)) return;

      await LN.schedule({ notifications: toSchedule });
      try { localStorage.setItem('bellsScheduled', '1'); } catch (e) {}
      console.log('[bell-native] re-armed ' + toSchedule.length +
                  ' bell(s); OS held ' + pendingCount);
    } catch (e) {
      console.warn('[bell-native] reschedule failed', e);
    }
  }

  /* FASTING path: queue the midday reflections, or clear them.

     Like the launch path, this checks permission and never requests it -- the
     fasting toggle lives in Settings and must not raise a system prompt. If
     permission was never granted the queue simply stays empty until the user
     presses Save on the bells, which is the one place a prompt belongs. */
  async function scheduleFastingReflections() {
    if (!isNative()) return;
    var LN = plugin();
    try {
      if (!isFasting()) return await cancelFastingReflections();

      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') return;     // check only -- no prompt

      var now = Date.now();
      var batch = [];
      for (var i = 0; i < FAST_DAYS; i++) {
        var at = new Date();
        at.setDate(at.getDate() + i);
        at.setHours(FAST_HOUR, 0, 0, 0);
        if (at.getTime() <= now + 60000) continue;   // today's noon already gone
        var item = fastTextFor(at);
        batch.push({
          id: FAST_ID_MIN + i,
          title: 'The Fast · ' + item.t,
          body: item.b,
          schedule: { at: at, allowWhileIdle: true },
          sound: bellSound()
        });
      }

      // Replace rather than add: a top-up must not leave yesterday's slots or
      // double-book a day already queued.
      await LN.cancel({ notifications: fastIds() });
      if (batch.length) await LN.schedule({ notifications: batch });
      console.log('[bell-native] fasting reflections queued: ' + batch.length);
    } catch (e) {
      console.warn('[bell-native] fasting schedule failed', e);
    }
  }

  /* Rewrite the bells in place, without prompting.

     Lauds' body depends on the fasting flag, and a repeating notification
     carries whatever text it was scheduled with -- so the toggle has to re-arm
     the bells or the morning line never changes. Permission is CHECKED, never
     requested: that belongs to Save alone. Scheduling the same ids overwrites,
     so there is no cancel here and no window where the bells are missing. */
  async function refreshBellText() {
    if (!isNative()) return;
    var LN = plugin();
    try {
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') return;     // check only -- no prompt
      var toSchedule = buildNotifications();
      if (!toSchedule.length) return;
      await LN.schedule({ notifications: toSchedule });
      console.log('[bell-native] bell text refreshed (fasting=' + isFasting() + ')');
    } catch (e) {
      console.warn('[bell-native] bell refresh failed', e);
    }
  }

  async function cancelFastingReflections() {
    if (!isNative()) return;
    try {
      await plugin().cancel({ notifications: fastIds() });
      console.log('[bell-native] fasting reflections cleared');
    } catch (e) {
      console.warn('[bell-native] fasting cancel failed', e);
    }
  }

  function launchCatchUp() {
    if (!isNative()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var anyOn = !!document.querySelector('.bell-toggle[aria-pressed="true"], .custom-bell-toggle[aria-pressed="true"]');
      if (anyOn) {
        clearInterval(timer);
        checkAndRescheduleBells();
      } else if (tries >= 60) {                   // ~30 seconds
        clearInterval(timer);
      }
    }, 500);
  }

  function init() {
    launchCatchUp();
    /* Top up the fasting queue on every launch, the way the Desert Fathers
       series does. Fourteen days is the cover; opening the app inside a
       fortnight keeps it full. Silent and permissionless when not fasting. */
    scheduleFastingReflections();
  }

  /* saveBellSettings() in index.html calls these directly now, instead of the
     old 400ms-after-click listener on #bellsSaveBtn. That listener raced its
     own save: it fired on a timer rather than after the toggles were read. */
  window.scheduleBells = scheduleBells;
  window.checkAndRescheduleBells = checkAndRescheduleBells;
  // toggleFastingFromSettings() in index.html drives these.
  window.scheduleFastingReflections = scheduleFastingReflections;
  window.cancelFastingReflections = cancelFastingReflections;
  window.refreshBellText = refreshBellText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
