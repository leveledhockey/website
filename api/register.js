const { google } = require('googleapis');
const { Resend } = require('resend');
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

    // Generate token once so it can be written to the sheet and used in the SMS.
    const token = randomUUID();

    // Append the registration row.
    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!A:N`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          new Date().toISOString(),        // Timestamp
          String(sessionId).trim(),        // Session ID
          sessionLabel,                    // Session Label
          String(player_first).trim(),     // Player First
          String(player_last).trim(),      // Player Last
          String(level || '').trim(),      // Level
          parent_name,                     // Parent Name
          String(phone).trim(),            // Phone
          String(email).trim(),            // Email
          'FALSE',                         // Paid?
          token,                           // Token
        ]],
      },
    });

    // Send registration confirmed email to parent.
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    process.env.EMAIL_FROM,
        to:      String(email).trim(),
        subject: `Registration Confirmed - ${String(player_first).trim()} ${String(player_last).trim()}`,
        html:    (() => {
          // Parses "Program - MM-DD-YY at H:MM (Location)"
          const labelMatch  = sessionLabel.match(/^(.+?) - \d{2}-\d{2}-\d{2} at (\d{1,2}:\d{2}) \((.+)\)$/);
          const sessionName = labelMatch ? `${labelMatch[1]}${level ? ' - ' + String(level).trim() : ''}` : sessionLabel;
          const sessionTime = labelMatch ? (() => { const [h, m] = labelMatch[2].split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; })() : '';
          const sessionLoc  = labelMatch ? labelMatch[3] : '';
          return `<p>Hello ${String(parent_name).trim()},</p>
                  <p>We have received your payment and confirmed ${String(player_first).trim()} ${String(player_last).trim()}'s registration for the following session with Leveled Hockey:</p>
                  <p>
                    <strong>Session Name: ${sessionName}</strong><br>
                    <strong>Time: ${sessionTime}</strong><br>
                    <strong>Location: ${sessionLoc}</strong>
                  </p>
                  <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
                  <p>See you on the ice!<br>Leveled Hockey</p>`;
        })(),
      });
    } catch (emailErr) {
      console.error('confirmation email error:', emailErr);
    }

    return res.status(200).json({ ok: true, message: 'Registration received.' });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
