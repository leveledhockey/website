const { google } = require('googleapis');
const { Resend } = require('resend');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS           = 'Registrations';

// Column indices (0-based) in the Registrations sheet:
// A=0 Timestamp, B=1 Session ID, C=2 Session Label, D=3 Player First,
// E=4 Player Last, F=5 Level, G=6 Parent Name, H=7 Phone,
// I=8 Email, J=9 Paid?, K=10 Status, L=11 Token
const COL_TOKEN         = 11;
const COL_STATUS        = 10;
const COL_PLAYER_FIRST  = 3;
const COL_PLAYER_LAST   = 4;
const COL_LEVEL         = 5;
const COL_PARENT_NAME   = 6;
const COL_SESSION_LABEL = 2;
const COL_EMAIL         = 8;

// "HH:MM" (24h) -> "H:MM AM/PM"
function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
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

module.exports = async function handleDecision(req, res, newStatus) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const token = (req.body && req.body.token) || (req.query && req.query.token);
  if (!token) {
    return res.status(400).send('Missing token.');
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
      range:         `${SHEET_REGISTRATIONS}!A1:L10000`,
    });

    const rows     = data.values || [];
    const dataRows = rows.slice(1); // skip header row

    const rowIndex = dataRows.findIndex(row => row[COL_TOKEN] === token);

    if (rowIndex === -1) {
      return res.status(400).send('Invalid or expired link.');
    }

    const row           = dataRows[rowIndex];
    const currentStatus = row[COL_STATUS] || '';

    // Idempotent - if already processed, just show the result.
    if (currentStatus !== 'Pending') {
      return res.status(200).send(page(
        `Already processed`,
        `This registration has already been <strong>${currentStatus.toLowerCase()}</strong>.`
      ));
    }

    // Sheet row number is 1-based + 1 for the header row.
    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!K${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody:      { values: [[newStatus]] },
    });

    const playerFirst  = row[COL_PLAYER_FIRST]  || '';
    const playerLast   = row[COL_PLAYER_LAST]   || '';
    const sessionLabel = row[COL_SESSION_LABEL] || '';
    const parentEmail  = row[COL_EMAIL]         || '';
    const action       = newStatus === 'Confirmed' ? 'confirmed' : 'denied';

    // Send confirmation/denial email to parent.
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subject = newStatus === 'Confirmed'
        ? `Registration Confirmed - ${playerFirst} ${playerLast}`
        : `Registration Update - ${playerFirst} ${playerLast}`;
      const parentFirst = row[COL_PARENT_NAME] ? row[COL_PARENT_NAME].split(' ')[0] : '';
      const level       = row[COL_LEVEL] || '';

      // Parse "PROGRAM - DD-MM-YYYY at HH:MM:SS (Location)" stored in the sheet
      const labelMatch    = sessionLabel.match(/^(.+?) - \d{2}-\d{2}-\d{4} at (\d{2}:\d{2}):\d{2} \((.+)\)$/);
      const sessionName   = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : sessionLabel.replace(/_/g, ' ');
      const sessionTime   = labelMatch ? formatTime(labelMatch[2]) : '';
      const sessionLoc    = labelMatch ? labelMatch[3] : '';

      const body = newStatus === 'Confirmed'
        ? `<p>Hi ${parentFirst},</p>
           <p>Great news! We have confirmed ${playerFirst} ${playerLast}'s registration for the following session:</p>
           <p>
             <strong>Session Name: ${sessionName}</strong><br>
             <strong>Time: ${sessionTime}</strong><br>
             <strong>Location: ${sessionLoc}</strong>
           </p>
           <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
           <p>See you on the ice!<br>Leveled Hockey</p>`
        : `<p>Hi ${parentFirst},</p>
           <p>Unfortunately, we weren't able to confirm <strong>${playerFirst} ${playerLast}</strong>'s registration for <strong>${sessionLabel.replace(/_/g, ' ')}</strong>.</p>
           <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
           <p>Leveled Hockey</p>`;

      await resend.emails.send({
        from:    process.env.EMAIL_FROM,
        to:      parentEmail,
        subject,
        html:    body,
      });
    } catch (emailErr) {
      // Email failure should not block the success page from showing.
      console.error('email error:', emailErr);
    }

    return res.status(200).send(page(
      `Registration ${newStatus}`,
      `<strong>${playerFirst} ${playerLast}</strong> has been ${action}.<br>
       <span style="color:#888;font-size:0.9em;">${sessionLabel.replace(/_/g, ' ')}</span>`
    ));
  } catch (err) {
    console.error('decision error:', err);
    return res.status(500).send('Server error. Please try again.');
  }
};

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center; padding: 0 1rem; }
    h2   { margin-bottom: 0.5rem; }
    p    { color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p>${body}</p>
</body>
</html>`;
}
