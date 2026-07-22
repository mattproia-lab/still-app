/*
 * bell-native.js — Still
 * ----------------------------------------------------------------------------
 * Schedules on-device local notifications (the monastery bell) for the
 * Liturgy of the Hours — and the user's own custom bells — when Still runs
 * as a NATIVE iOS/Android build.
 *
 * IDs: 1-4 the four Hours (vigils/lauds/vespers/compline), 5-7 custom slots.
 * The Hours ring with the user's chosen Bell Voice (still_bell_voice);
 * each custom slot carries its own voice. Launch path only ever ARMS
 * (never cancels); cancelling belongs to the explicit Save action, which
 * verifies against iOS's pending list and confirms with a toast.
 * ----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var HOUR_IDS = { vigils: 1, lauds: 2, vespers: 3, compline: 4 };
  var CUSTOM_BASE_ID = 4; // slot N -> id 4+N (5,6,7)
  var ALL_IDS = [1, 2, 3, 4, 5, 6, 7];

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

  function hourVoice() {
    try { return localStorage.getItem('still_bell_voice') || 'bell-call.wav'; }
    catch (e) { return 'bell-call.wav'; }
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
    var voice = hourVoice();
    var list = readHourSchedule()
      .filter(function (s) { return s.on; })
      .map(function (s) {
        return {
          id: HOUR_IDS[s.hour],
          title: TITLES[s.hour],
          body: BODY,
          sound: voice,
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
          sound: c.voice,
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
          ? 'The bells are set \u2014 ' + bells.length + ' scheduled.'
          : 'No bells scheduled \u2014 check your toggles and try again.');
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

  // SAVE path: authoritative. Cancels ids 1-7, re-schedules what's on,
  // verifies with a visible toast.
  async function saveBells() {
    if (!isNative()) return;
    var LN = plugin();
    try {
      if (!(await ensurePermission())) {
        showBellToast('Notifications are off for Still \u2014 enable them in iPhone Settings to hear the bells.');
        return;
      }

      var toSchedule = buildNotifications();

      await LN.cancel({
        notifications: ALL_IDS.map(function (id) { return { id: id }; })
      });

      if (toSchedule.length) {
        await LN.schedule({ notifications: toSchedule });
        try { localStorage.setItem('bellsScheduled', '1'); } catch (e) {}
      } else {
        try { localStorage.removeItem('bellsScheduled'); } catch (e) {}
      }

      await verifyPending(true);
    } catch (e) {
      console.warn('[bell-native] save failed', e);
      showBellToast('Could not set the bells \u2014 please try again.');
    }
  }

  // LAUNCH path: protective. NEVER cancels. Arms only when at least one
  // toggle is visibly ON and iOS holds fewer than expected.
  async function launchArm() {
    if (!isNative()) return;
    var LN = plugin();
    try {
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') return;

      var toSchedule = buildNotifications();
      if (!toSchedule.length) return;

      var pendingCount = await verifyPending(false);
      if (pendingCount >= toSchedule.length) return;

      await LN.schedule({ notifications: toSchedule });
      try { localStorage.setItem('bellsScheduled', '1'); } catch (e) {}
      console.log('[bell-native] launch re-armed ' + toSchedule.length + ' bell(s)');
    } catch (e) {
      console.warn('[bell-native] launch arm failed', e);
    }
  }

  function hookSaveButton() {
    var btn = document.getElementById('bellsSaveBtn');
    if (!btn || btn._bellHooked) return;
    btn._bellHooked = true;
    btn.addEventListener('click', function () { setTimeout(saveBells, 400); });
  }

  function launchCatchUp() {
    if (!isNative()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      hookSaveButton();

      var anyOn = !!document.querySelector('.bell-toggle[aria-pressed="true"], .custom-bell-toggle[aria-pressed="true"]');
      if (anyOn) {
        clearInterval(timer);
        launchArm();
      } else if (tries >= 60) { // ~30 seconds
        clearInterval(timer);
        hookSaveButton();
      }
    }, 500);
  }

  function init() {
    hookSaveButton();
    launchCatchUp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();