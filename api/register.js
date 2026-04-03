const { google } = require('googleapis');

const SPREADSHEET_ID     = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_REGISTRATIONS = 'Registrations';

// Must match the tab names in Google Sheets exactly.
const VALID_PROGRAM_CODES = ['PEP', 'OVERSPEED', 'PUCK_SKILLS', 'BATTLE_CAMP', 'DEFENSE_CAMP'];

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
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

    // Fetch the program's session sheet and existing registrations in one call.
    const { data } = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [`${programCode}!A1:F`, `${SHEET_REGISTRATIONS}!B1:B`],
    });

    const [programRange, regRange] = data.valueRanges;
    const sessionRows = programRange.values || [];
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
    const regCount = (regRange.values || [])
      .slice(1)
      .filter(([sid]) => sid === String(sessionId).trim()).length;

    if (regCount >= maxParticipants) {
      return res.status(409).json({ error: 'Sorry, this session is now full.' });
    }

    // Human-readable label written to the Registrations sheet for admin readability.
    const sessionLabel = `${programCode} — ${sessionObj['Date']} at ${sessionObj['Time']} (${sessionObj['Location']})`;

    // Append the registration row.
    await sheets.spreadsheets.values.append({
      spreadsheetId:   SPREADSHEET_ID,
      range:           `${SHEET_REGISTRATIONS}!A:L`,
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
        ]],
      },
    });

    return res.status(200).json({ ok: true, message: 'Registration received.' });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
