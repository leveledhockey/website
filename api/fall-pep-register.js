const { google } = require('googleapis');
const Stripe = require('stripe');
const {
  FALL_PEP_PROGRAM_CAP,
  FALL_PEP_AMOUNT,
  getFallPepCohortByPackageId,
  isFallPepProgramLabel,
} = require('./fall-pep-config');
const { gstPortionCents } = require('./gst');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';

// Fall 2026 Power Edge Pro — 11-session package. Two fixed-schedule cohorts (Wednesday
// and Thursday, Oct 7/8 - Dec 16/17, 4:00-4:50 PM) — see fall-pep-config.js.
// A full-program purchase writes an identical row to all 11 sessions of its cohort in
// one webhook call — registration counts are tracked off each cohort's canonical
// session to avoid a 13x overcount.

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
  const cohort = getFallPepCohortByPackageId(String(packageId || '').trim());
  if (!cohort) {
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
      row[0] === cohort.canonicalSessionId && isFallPepProgramLabel(row[1])
    ).length;

    if (programCount >= FALL_PEP_PROGRAM_CAP) {
      return res.status(409).json({ error: 'Sorry, the Fall Program is full.' });
    }

    const gstAmount = gstPortionCents(FALL_PEP_AMOUNT);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      FALL_PEP_AMOUNT + gstAmount,
      currency:    'cad',
      description: cohort.label,
      metadata: {
        type:         'fall_pep_program',
        packageId:    cohort.packageId,
        player_first: String(player_first).trim(),
        player_last:  String(player_last).trim(),
        level:        String(level || '').trim(),
        birthYear:    String(birth_year).trim(),
        parent_name:  String(parent_name).trim(),
        phone:        String(phone).trim(),
        email:        String(email).trim(),
        mailList:     mailList === 'true' ? 'true' : 'false',
        timestamp:    new Date().toISOString(),
        baseAmountCents: String(FALL_PEP_AMOUNT),
        gstAmountCents:  String(gstAmount),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('fall-pep-register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
