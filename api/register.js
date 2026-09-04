const { google } = require('googleapis');
const Stripe = require('stripe');

const SPREADSHEET_ID               = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';
const SCHEDULE_SHEET               = 'Schedule';

const STANDARD_DROPIN_AMOUNT = 5500; // $55.00 CAD

// Fall 2026 Power Edge Pro sessions are $65/session instead of the standard $55, and
// run a hard capacity partition: only 4 of each session's 20 seats are ever sold as
// drop-in — the other 16 are reserved for the 13-session program and never spill over,
// even if the program under-sells. No sheet schema change: a program registration is
// told apart from a drop-in registration by the sessionLabel text already written to
// column C (see FALL_PEP_LABEL). When full-program registration closes, bump
// FALL_PEP_DROPIN_CAP up (e.g. to 20) to open the unsold program seats to drop-in.
// Hard-coded to these 13 session IDs (Wednesdays, Sept 23 - Dec 16, 4:00-4:50 PM).
const FALL_PEP_DROPIN_AMOUNT = 6500; // $65.00 CAD
const FALL_PEP_DROPIN_CAP    = 4;
const FALL_PEP_LABEL         = 'Fall 2026 Power Edge Pro — 13-Session Program';
const FALL_PEP_DROPIN_SESSION_IDS = new Set([
  'PEP_09-23-26_16:00', 'PEP_09-30-26_16:00', 'PEP_10-07-26_16:00', 'PEP_10-14-26_16:00',
  'PEP_10-21-26_16:00', 'PEP_10-28-26_16:00', 'PEP_11-04-26_16:00', 'PEP_11-11-26_16:00',
  'PEP_11-18-26_16:00', 'PEP_11-25-26_16:00', 'PEP_12-02-26_16:00', 'PEP_12-09-26_16:00',
  'PEP_12-16-26_16:00',
]);
function isFallPepProgramLabel(label) {
  return String(label || '').startsWith(FALL_PEP_LABEL);
}

function getAuth() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  raw = raw.replace(/\n/g, '\\n');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    sessionId, player_first, player_last, level, birth_year,
    parent_name, phone, email, mailList,
  } = req.body || {};

  // Server-side validation
  const requiredFields = { sessionId, player_first, player_last, birth_year, parent_name, phone, email };
  if (Object.values(requiredFields).some(v => !v || !String(v).trim())) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch the unified schedule sheet and existing registrations in parallel.
    const [scheduleRes, regRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range:         `${SCHEDULE_SHEET}!A1:H`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
        range:         `${SHEET_REGISTRATIONS}!B1:C10000`,
      }),
    ]);

    const scheduleRows = scheduleRes.data.values || [];
    const regRows      = regRes.data.values || [];
    const headers      = scheduleRows[0] || [];

    // Validate the session ID exists in the schedule sheet.
    const sessionRow = scheduleRows.slice(1).find(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj['SessionID'] === String(sessionId).trim();
    });

    if (!sessionRow) {
      return res.status(400).json({ error: 'Invalid session.' });
    }

    const sessionObj = {};
    headers.forEach((h, i) => { sessionObj[h] = sessionRow[i] || ''; });

    const maxParticipants  = parseInt(sessionObj['Max Participants'], 10);
    const trimmedSessionId = String(sessionId).trim();
    const isFallPepDropin  = FALL_PEP_DROPIN_SESSION_IDS.has(trimmedSessionId);

    // Count live registrations for this session to enforce capacity. Fall PEP
    // sessions run a hard partition, so only drop-in-labeled rows count against
    // the drop-in cap — program registrations are tracked separately and never
    // eat into this pool.
    const regCount = regRows
      .slice(1)
      .filter(row => {
        if (row[0] !== trimmedSessionId) return false;
        return isFallPepDropin ? !isFallPepProgramLabel(row[1]) : true;
      }).length;

    const capacity = isFallPepDropin ? FALL_PEP_DROPIN_CAP : maxParticipants;
    if (regCount >= capacity) {
      return res.status(409).json({ error: 'Sorry, this session is now full.' });
    }

    // Human-readable label stored in metadata for the webhook to use.
    // Format: "Program - MM-DD-YY at H:MM (Location)"
    const sessionLabel = `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']} at ${sessionObj['Time (24H clock)']} (${sessionObj['Location']})`;

    const amount = isFallPepDropin ? FALL_PEP_DROPIN_AMOUNT : STANDARD_DROPIN_AMOUNT;

    // Store all registration data in PaymentIntent metadata so the webhook can
    // write the spreadsheet row only after payment actually succeeds.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency:    'cad',
      description: `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']}`,
      metadata: {
        sessionId:      String(sessionId).trim(),
        sessionLabel,
        sessionEndTime: String(sessionObj['End Time (24H clock)'] || '').trim(),
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
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
