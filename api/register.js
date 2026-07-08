const { google } = require('googleapis');
const Stripe = require('stripe');

const SPREADSHEET_ID               = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';
const SCHEDULE_SHEET               = 'Schedule';

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
    sessionId, player_first, player_last, level,
    parent_name, phone, email, mailList,
  } = req.body || {};

  // Server-side validation
  const requiredFields = { sessionId, player_first, player_last, parent_name, phone, email };
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
        range:         `${SHEET_REGISTRATIONS}!B1:B10000`,
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

    const maxParticipants = parseInt(sessionObj['Max Participants'], 10);

    // Count live registrations for this session to enforce capacity.
    const regCount = regRows
      .slice(1)
      .filter(([sid]) => sid === String(sessionId).trim()).length;

    if (regCount >= maxParticipants) {
      return res.status(409).json({ error: 'Sorry, this session is now full.' });
    }

    // Human-readable label stored in metadata for the webhook to use.
    // Format: "Program - MM-DD-YY at H:MM (Location)"
    const sessionLabel = `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']} at ${sessionObj['Time (24H clock)']} (${sessionObj['Location']})`;

    // Store all registration data in PaymentIntent metadata so the webhook can
    // write the spreadsheet row only after payment actually succeeds.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      5500, // $55.00 CAD in cents
      currency:    'cad',
      description: `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']}`,
      metadata: {
        sessionId:    String(sessionId).trim(),
        sessionLabel,
        player_first: String(player_first).trim(),
        player_last:  String(player_last).trim(),
        level:        String(level || '').trim(),
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
