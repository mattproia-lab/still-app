// netlify/functions/referral-report.js
// Commission reporting for referral reps, and for whoever is on ADMIN_EMAILS.
//
// The rep_commissions view and the payouts table are both service-role only
// (2026-08-26 migration, sections 6 and 8). That is deliberate: a Postgres view
// runs with its OWNER's privileges, so RLS on profiles does not filter it, and
// anything able to read it directly would read every rep's subscribers, codes
// and email. This function is the only way in. It resolves the caller from
// their own JWT -- never from anything the client sends -- and filters by that
// identity before a row is returned.

const SUPA_URL = process.env.SUPABASE_URL || 'https://zbskapivansfewegllnz.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

/* The columns the portal needs off a code. Selected explicitly rather than
   with *, so a column added to promo_codes later is not published to every rep
   by accident. */
const CODE_COLUMNS = 'code,channel,description,rep_name,rep_email,max_referrals,uses_remaining';

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...CORS },
  body: JSON.stringify(payload)
});

/* Admins come from ADMIN_EMAILS, comma-separated, compared lowercased and
   trimmed -- an env var edited by hand will eventually carry a stray space.
   An unset or empty variable yields NO admins. It must fail closed: a typo in
   the variable name should lock everyone out of the admin view, never open it. */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/* Same shape as delete-account.js: the token is checked by Supabase itself,
   so a forged or expired one cannot get past this. */
async function getUserFromToken(token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function supaSelect(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPA_SERVICE_KEY, 'Authorization': `Bearer ${SUPA_SERVICE_KEY}` }
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const header = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return json(401, { error: 'Not authenticated.' });

  const user = await getUserFromToken(token);
  if (!user || !user.email) return json(401, { error: 'Not authenticated.' });

  const email = user.email.trim().toLowerCase();
  const isAdmin = adminEmails().includes(email);

  try {
    // eq. and not ilike. ilike would be tolerant of case, but % and _ are
    // wildcards in it -- first_last@example.com is an ordinary address that
    // would over-match, and a mailbox of literally "%" would match every rep.
    // A security filter should not be a pattern match. The cost is that
    // promo_codes.rep_email and payouts.rep_email must be stored lowercase.
    const mine = `rep_email=eq.${encodeURIComponent(email)}`;

    // Filtering happens in the database, so a rep's request never materialises
    // another rep's rows in this process at all.
    //
    // codes is queried separately from commissions rather than being folded
    // into the view. rep_commissions has one row per SUBSCRIBER, so a code
    // with no live subscribers -- a new code, or one whose referrals have all
    // churned -- does not appear in it at all. Without this query such a rep
    // gets an empty report and cannot tell that from a broken page. It also
    // carries max_referrals, which the view has no column for.
    const [commissions, payouts, codes] = await Promise.all([
      supaSelect(isAdmin
        ? 'rep_commissions?select=*&order=rep_email.asc,redeemed_at.desc'
        : `rep_commissions?select=*&${mine}&order=redeemed_at.desc`),
      supaSelect(isAdmin
        ? 'payouts?select=*&order=period_start.desc'
        : `payouts?select=*&${mine}&order=period_start.desc`),
      supaSelect(isAdmin
        ? `promo_codes?select=${CODE_COLUMNS}&order=rep_email.asc,code.asc`
        : `promo_codes?select=${CODE_COLUMNS}&${mine}&order=code.asc`)
    ]);

    // A signed-in user who is not a rep gets empty arrays, not a 403. They are
    // not forbidden, they simply have nothing -- and a 403 would confirm to a
    // prober which addresses are reps.
    return json(200, { admin: isAdmin, email, commissions, payouts, codes });
  } catch (e) {
    console.error('referral-report:', e.message);
    return json(500, { error: 'Report unavailable.' });
  }
};
