const ONESIGNAL_APP_ID = '19eccbcf-5a1f-42ba-a23c-54726795a751';
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

exports.handler = async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(
    `${SUPA_URL}/rest/v1/bell_preferences?lauds=eq.true&select=user_id`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return { statusCode: 500, body: 'Supabase error' };
  const users = await res.json();
  for (const user of users) {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [user.user_id] },
        target_channel: 'push',
        headings: { en: 'Lauds' },
        contents: { en: 'The bell rings for Lauds. Be still and enter prayer.' },
        url: 'https://stillprayer.app'
      })
    });
  }
  return { statusCode: 200, body: JSON.stringify({ sent: users.length }) };
};