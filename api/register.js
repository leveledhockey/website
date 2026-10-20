const { google } = require('googleapis');
const Stripe = require('stripe');
const { gstPortionCents } = require('./gst');

const SPREADSHEET_ID               = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';
const SCHEDULE_SHEET               = 'Schedule';

const DEFAULT_DROPIN_COST = 55; // CAD, used when a Schedule row leaves Cost blank

function getSessionCost(obj) {
  const raw = parseFloat(obj['Cost']);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DROPIN_COST;
}

// Every session enforces the same capacity rule: "Max Participants" from the Schedule
// sheet, counted against every registration row for that session ID. The Fall 2026
// Power Edge Pro sessions used to reserve 16 of their 20 seats for the 11-session
// program and cap drop-ins at 4; the program is now closed, so those sessions take
// drop-ins up to their full capacity. See api/fall-pep-config.js.

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
        range:         `${SCHEDULE_SHEET}!A1:I`,
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

    // Count live registrations for this session to enforce capacity. Every row against
    // this session ID occupies a seat, including the rows written by the (now closed)
    // Fall PEP full-program purchases.
    const regCount = regRows
      .slice(1)
      .filter(row => row[0] === trimmedSessionId).length;

    if (regCount >= maxParticipants) {
      return res.status(409).json({ error: 'Sorry, this session is now full.' });
    }

    // Human-readable label stored in metadata for the webhook to use.
    // Format: "Program - MM-DD-YY at H:MM (Location)"
    const sessionLabel = `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']} at ${sessionObj['Time (24H clock)']} (${sessionObj['Location']})`;

    const baseAmount = Math.round(getSessionCost(sessionObj) * 100);
    const gstAmount   = gstPortionCents(baseAmount);
    const amount      = baseAmount + gstAmount;

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
        baseAmountCents: String(baseAmount),
        gstAmountCents:  String(gstAmount),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
