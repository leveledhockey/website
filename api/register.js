const { google } = require('googleapis');
const twilio = require('twilio');
const { randomUUID } = require('crypto');

const SPREADSHEET_ID              = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS          = 'Registrations';

// Must match the tab names in Google Sheets exactly.
const VALID_PROGRAM_CODES = ['PEP', 'OVERSPEED', 'PUCK_SKILLS', 'BATTLE_CAMP', 'DEFENSE_CAMP'];

function getAuth() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
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
    sessionId, player_first, player_last, birth_year, position,
    parent_name, phone, email, notes,
  } = req.body || {};

  // Server-side validation
  const requiredFields = { sessionId, player_first, player_last, birth_year, parent_name, phone, email };
  if (Object.values(requiredFields).some(v => !v || !String(v).trim())) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  const birthYearNum = parseInt(birth_year, 10);
  if (isNaN(birthYearNum) || birthYearNum < 2000 || birthYearNum > 2022) {
    return res.status(400).json({ error: 'Invalid birth year.' });
  }

  // Derive program code from session ID (format: {PROGRAM}-{YYYY}-{MM}-{DD}-{HH}).
  // Validate against the known list to prevent arbitrary sheet name injection.
  const programCode = String(sessionId).trim().split('-')[0].toUpperCase();
  if (!VALID_PROGRAM_CODES.includes(programCode)) {
    return res.status(400).json({ error: 'Invalid session.' });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch the program's session sheet and existing registrations in parallel.
    const [programRes, regRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${programCode}!A1:F`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
        range: `${SHEET_REGISTRATIONS}!B1:B10000`,
      }),
    ]);

    const sessionRows = programRes.data.values || [];
    const regRows     = regRes.data.values || [];
    const headers     = sessionRows[0] || [];

    // Validate the session ID exists in the program's sheet.
    const sessionRow = sessionRows.slice(1).find(row => row[0] === String(sessionId).trim());
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
    const sessionLabel = `${programCode} — ${sessionObj['Date']} at ${sessionObj['Time']} (${sessionObj['Location']})`;

    // Generate token once so it can be written to the sheet and used in the SMS.
    const token = randomUUID();

    // Append the registration row.
    await sheets.spreadsheets.values.append({
      spreadsheetId:   REGISTRATIONS_SPREADSHEET_ID,
      range:           `${SHEET_REGISTRATIONS}!A:N`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          new Date().toISOString(),
          String(sessionId).trim(),
          sessionLabel,
          String(player_first).trim(),
          String(player_last).trim(),
          String(birth_year).trim(),
          String(position || '').trim(),
          String(parent_name).trim(),
          String(phone).trim(),
          String(email).trim(),
          String(notes || '').trim(),
          'FALSE',
          'Pending',
          token,
        ]],
      },
    });

    // Send SMS to owner with one-tap approve/deny links.
    // SMS failure should not block the registration from succeeding.
    try {
      const smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const msg = await smsClient.messages.create({
        from: process.env.TWILIO_FROM_NUMBER,
        to:   process.env.OWNER_PHONE_NUMBER,
        body: `New reg: ${String(player_first).trim()} ${String(player_last).trim()}\n${process.env.SITE_URL}/api/review?token=${token}`,
      });
      console.log('SMS sent:', msg.sid, msg.status);
    } catch (smsErr) {
      console.error('SMS error:', smsErr);
    }

    return res.status(200).json({ ok: true, message: 'Registration received.' });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
