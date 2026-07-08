const { google } = require('googleapis');

const EMAIL_SPREADSHEET_ID = process.env.GOOGLE_EMAIL_SPREADSHEET_ID;
const EMAIL_SHEET = 'emails';

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

  const { email } = req.body || {};
  const trimmed = String(email || '').trim().toLowerCase();

  if (!trimmed || !trimmed.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const [metaRes, dataRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: EMAIL_SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: EMAIL_SPREADSHEET_ID,
        range:         `${EMAIL_SHEET}!A:B`,
      }),
    ]);

    const sheetMeta = metaRes.data.sheets.find(s => s.properties.title === EMAIL_SHEET);
    if (!sheetMeta) {
      return res.status(500).json({ error: 'Email sheet not found.' });
    }
    const sheetId = sheetMeta.properties.sheetId;

    const rows = dataRes.data.values || [];

    // Collect row indices (0-based) where column B matches the email
    const toDelete = rows
      .map((row, i) => ({ i, cell: String(row[1] || '').trim().toLowerCase() }))
      .filter(({ cell }) => cell === trimmed)
      .map(({ i }) => i);

    if (toDelete.length > 0) {
      // Delete from bottom to top so indices don't shift
      toDelete.sort((a, b) => b - a);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: EMAIL_SPREADSHEET_ID,
        requestBody: {
          requests: toDelete.map(rowIndex => ({
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
            },
          })),
        },
      });
    }

    // Always return success — don't reveal whether the email was on the list
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('unsubscribe error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
