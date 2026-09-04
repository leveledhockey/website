const { google } = require('googleapis');
const Stripe = require('stripe');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';

// Fall 2026 Power Edge Pro — 13-session package. Hard-coded: this is a single,
// fixed-schedule program (Wednesdays, Sept 23 - Dec 16, 4:00-4:50 PM).
const FALL_PEP_PACKAGE_ID  = 'fall-pep-2026';
const FALL_PEP_LABEL       = 'Fall 2026 Power Edge Pro 13-Session Program';
const FALL_PEP_AMOUNT      = 69900; // $699.00 CAD

// Hard capacity partition: only 16 of the 20 seats in each session are ever sold as
// the full program — the other 4 are reserved for drop-in and never touched here.
// When full-program registration closes, this cap can simply be raised.
const FALL_PEP_PROGRAM_CAP = 16;
// A full-program purchase writes an identical row to all 13 sessions in one webhook
// call — count registrations off a single canonical session to avoid a 13x overcount.
const FALL_PEP_CANONICAL_SESSION_ID = 'PEP_09-23-26_16:00';

function getAuth() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  raw = raw.replace(/\n/g, '\\n');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { packageId, player_first, player_last, level, birth_year, parent_name, phone, email, mailList } = req.body || {};

  const requiredFields = { player_first, player_last, birth_year, parent_name, phone, email };
  if (Object.values(requiredFields).some(v => !v || !String(v).trim())) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (String(packageId || '').trim() !== FALL_PEP_PACKAGE_ID) {
    return res.status(400).json({ error: 'Invalid package selection.' });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const regRes = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
      range:         `${SHEET_REGISTRATIONS}!B1:C10000`,
    });
    const regRows = (regRes.data.values || []).slice(1);
    const programCount = regRows.filter(row =>
      row[0] === FALL_PEP_CANONICAL_SESSION_ID && String(row[1] || '').startsWith(FALL_PEP_LABEL)
    ).length;

    if (programCount >= FALL_PEP_PROGRAM_CAP) {
      return res.status(409).json({ error: 'Sorry, the Fall Program is full.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      FALL_PEP_AMOUNT,
      currency:    'cad',
      description: FALL_PEP_LABEL,
      metadata: {
        type:         'fall_pep_program',
        packageId:    FALL_PEP_PACKAGE_ID,
        player_first: String(player_first).trim(),
        player_last:  String(player_last).trim(),
        level:        String(level || '').trim(),
        birthYear:    String(birth_year).trim(),
        parent_name:  String(parent_name).trim(),
        phone:        String(phone).trim(),
        email:        String(email).trim(),
        mailList:     mailList === 'true' ? 'true' : 'false',
        timestamp:    new Date().toISOString(),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('fall-pep-register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
