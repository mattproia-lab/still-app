// netlify/functions/bell-vigils.js
//
// STUB. Bell delivery is client-side now.
//
// This used to POST Vigils to OneSignal on an hourly cron, filtering users
// by their local hour. It stopped reaching anyone when the OneSignal web SDK
// was removed in 2391f30 and nothing replaced it: the push targeted
// include_aliases.external_id, an alias only the web SDK ever registered for
// browser users, and initOneSignal() -- the native half -- is defined in
// index.html but never called.
//
// Bells are now scheduled on the device by bell-native.js through
// @capacitor/local-notifications, as repeating daily notifications on ids 1-4.
// They need no server, survive being offline, and ring at the device's own
// local time rather than a timezone column that could be null.
//
// Kept as a stub rather than deleted so the scheduled invocation in
// netlify.toml has something to call and does not error. Safe to remove
// together with its [functions.bell-vigils] block.

exports.handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({
    ok: true,
    hour: 'vigils',
    delivery: 'client-side',
    note: 'Vigils bells are scheduled on-device by bell-native.js via @capacitor/local-notifications. This endpoint no longer sends anything.'
  })
});
