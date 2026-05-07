const { google } = require('googleapis');
const Stripe = require('stripe');
const { randomUUID } = require('crypto');

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
    parent_name, phone, email,
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
        range:         `${SCHEDULE_SHEET}!A1:G`,
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

    // Human-readable label written to the Registrations sheet for admin readability.
    // Format: "Program - MM-DD-YY at H:MM (Location)"
    const sessionLabel = `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']} at ${sessionObj['Time (24H clock)']} (${sessionObj['Location']})`;

    const token = randomUUID();

    // Create a Stripe PaymentIntent — $55.00 CAD. The token in metadata lets the
    // webhook find this row after payment succeeds.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      5500, // $55.00 CAD in cents
      currency:    'cad',
      description: `${sessionObj['Program']} - ${sessionObj['Date (MM-DD-YY)']}`,
      metadata:    { token },
    });

    // Append the registration row.
    // Column order must match stripe-webhook.js column constants:
    //   A=Timestamp B=SessionID C=SessionLabel D=PlayerFirst E=PlayerLast
    //   F=Level G=ParentName H=Phone I=Email J=Paid K=Status L=Token
    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!A:L`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          new Date().toISOString(),        // A - Timestamp
          String(sessionId).trim(),        // B - Session ID
          sessionLabel,                    // C - Session Label
          String(player_first).trim(),     // D - Player First
          String(player_last).trim(),      // E - Player Last
          String(level || '').trim(),      // F - Level
          parent_name,                     // G - Parent Name
          String(phone).trim(),            // H - Phone
          String(email).trim(),            // I - Email
          'FALSE',                         // J - Paid?
          '',                              // K - Status (webhook sets to 'Confirmed')
          token,                           // L - Token (COL_TOKEN=11 in stripe-webhook.js)
        ]],
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
