const { google } = require('googleapis');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS           = 'Registrations';

// Column indices (0-based) in the Registrations sheet:
// A=0 Timestamp, B=1 Session ID, C=2 Session Label, D=3 Player First,
// E=4 Player Last, F=5 Birth Year, G=6 Position, H=7 Parent Name,
// I=8 Phone, J=9 Email, K=10 Notes, L=11 Paid?, M=12 Status, N=13 Token
const COL_TOKEN        = 13;
const COL_STATUS       = 12;
const COL_PLAYER_FIRST = 3;
const COL_PLAYER_LAST  = 4;
const COL_SESSION_LABEL = 2;

function getAuth() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
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
      range:         `${SHEET_REGISTRATIONS}!A1:N10000`,
    });

    const rows     = data.values || [];
    const dataRows = rows.slice(1); // skip header row

    const rowIndex = dataRows.findIndex(row => row[COL_TOKEN] === token);

    if (rowIndex === -1) {
      return res.status(400).send('Invalid or expired link.');
    }

    const row           = dataRows[rowIndex];
    const currentStatus = row[COL_STATUS] || '';

    // Idempotent — if already processed, just show the result.
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
      range:            `${SHEET_REGISTRATIONS}!M${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody:      { values: [[newStatus]] },
    });

    const playerFirst  = row[COL_PLAYER_FIRST]  || '';
    const playerLast   = row[COL_PLAYER_LAST]   || '';
    const sessionLabel = row[COL_SESSION_LABEL] || '';
    const action       = newStatus === 'Confirmed' ? 'confirmed' : 'denied';

    // TODO: Send confirmation/denial email to parent (item 5 — Resend).

    return res.status(200).send(page(
      `Registration ${newStatus}`,
      `<strong>${playerFirst} ${playerLast}</strong> has been ${action}.<br>
       <span style="color:#888;font-size:0.9em;">${sessionLabel}</span>`
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
