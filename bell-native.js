/*
 * bell-native.js — Still
 * ----------------------------------------------------------------------------
 * Schedules on-device local notifications (the monastery bell) for the
 * Liturgy of the Hours when Still runs as a NATIVE iOS/Android build.
 *
 * In a normal browser or PWA this script does nothing on purpose — the
 * existing OneSignal web-push functions handle those visitors. It only
 * activates inside the Capacitor native shell, where iOS can play a
 * bundled bell sound even while the app is closed.
 *
 * How it stays in sync with the user's choices:
 *   - It reads the four .bell-row switches by their data-hour + aria-pressed.
 *   - It re-runs whenever the user taps "Save Bell Schedule".
 *   - On launch it waits for the saved preferences to populate the toggles,
 *     then schedules — so a user who set their Hours before installing the
 *     native app still gets bells without opening Settings.
 * ----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // One fixed notification ID per Hour, so we can cancel/reschedule cleanly.
  var HOUR_IDS = { vigils: 1, lauds: 2, vespers: 3, compline: 4 };

  // Used only if the on-screen time text can't be parsed for some reason.
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

  // The bell file bundled into the iOS app (added to the Xcode project).
  var BELL_SOUND = 'bell-call.wav';

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

  // "4:00 AM" / "6:00 PM" / "12:00 AM" -> { hour, minute } in 24-hour time.
  function parseTime(text) {
    if (!text) return null;
    var m = text.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/);
    if (!m) return null;
    var hour = parseInt(m[1], 10);
    var minute = parseInt(m[2], 10);
    var pm = /[Pp][Mm]/.test(m[3]);
    if (hour === 12) hour = 0;   // 12 AM -> 0
    if (pm) hour += 12;          // ...and 12 PM -> 12
    return { hour: hour, minute: minute };
  }

  // Read each .bell-row: which Hour, its time, and whether it's switched on.
  function readSchedule() {
    var rows = document.querySelectorAll('.bell-row');
    var schedule = [];
    rows.forEach(function (row) {
      var hour = row.getAttribute('data-hour');
      if (!hour || !HOUR_IDS[hour]) return;

      var toggle = row.querySelector('.bell-toggle');
      var on = !!toggle && toggle.getAttribute('aria-pressed') === 'true';

      // Find the div whose text looks like a clock time.
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

  async function syncBells() {
    if (!isNative()) return;
    var LN = plugin();
    try {
      // Make sure we're allowed to post notifications.
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LN.requestPermissions();
        if (perm.display !== 'granted') return; // declined — nothing to do
      }

      var schedule = readSchedule();

      // Clear the four Hour notifications, then re-add the ones switched on.
      await LN.cancel({
        notifications: Object.keys(HOUR_IDS).map(function (h) {
          return { id: HOUR_IDS[h] };
        })
      });

      var toSchedule = schedule
        .filter(function (s) { return s.on; })
        .map(function (s) {
          return {
            id: HOUR_IDS[s.hour],
            title: TITLES[s.hour],
            body: BODY,
            sound: BELL_SOUND,
            schedule: {
              on: { hour: s.time.hour, minute: s.time.minute },
              allowWhileIdle: true
            }
          };
        });

      if (toSchedule.length) {
        await LN.schedule({ notifications: toSchedule });
        try { localStorage.setItem('bellsScheduled', '1'); } catch (e) {}
      }
      console.log('[bell-native] scheduled ' + toSchedule.length + ' bell(s)');
    } catch (e) {
      console.warn('[bell-native] sync failed', e);
    }
  }

  // Re-sync whenever the user saves their bell schedule.
  function hookSaveButton() {
    var btn = document.getElementById('bellsSaveBtn');
    if (!btn || btn._bellHooked) return;
    btn._bellHooked = true;
    // Run shortly after the app's own saveBellSettings() persists to Supabase.
    btn.addEventListener('click', function () { setTimeout(syncBells, 400); });
  }

  // Catch-up at launch: wait for saved prefs to populate the toggles, then sync.
  // We only sync once prefs look loaded (any toggle on) or once we've scheduled
  // before — so we never wrongly cancel a real schedule on a slow load.
  function launchCatchUp() {
    if (!isNative()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      hookSaveButton();

      var anyOn = !!document.querySelector('.bell-toggle[aria-pressed="true"]');
      var scheduledBefore = false;
      try { scheduledBefore = localStorage.getItem('bellsScheduled') === '1'; }
      catch (e) {}

      if (anyOn || scheduledBefore) {
        clearInterval(timer);
        syncBells();
      } else if (tries >= 20) { // ~10 seconds
        clearInterval(timer);
        hookSaveButton(); // still wire up Save for later
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