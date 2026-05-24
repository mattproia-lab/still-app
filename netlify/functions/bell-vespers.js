const ONESIGNAL_APP_ID = '19eccbcf-5a1f-42ba-a23c-54726795a751';
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';
exports.handler = async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(`${SUPA_URL}/rest/v1/bell_preferences?vespers=eq.true&select=user_id,timezone`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } });
  if (!res.ok) return { statusCode: 500, body: 'Supabase error' };
  const users = await res.json();
  const now = new Date();
  const eligible = users.filter(user => {
    try {
      const tz = user.timezone || 'America/New_York';
      const localHour = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', hour12: false
      }).format(now));
      return localHour === 18; // 6pm
    } catch(e) { return false; }
  });
  for (const user of eligible) {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}` },
      body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, include_aliases: { external_id: [user.user_id] }, target_channel: 'push', headings: { en: 'Vespers' }, contents: { en: 'Vespers bell. Draw near in the quiet.' }, url: 'https://stillprayer.app' })
    });
  }
  return { statusCode: 200, body: JSON.stringify({ sent: eligible.length }) };
};