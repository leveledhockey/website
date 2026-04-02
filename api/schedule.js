const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_SESSIONS = 'Sessions';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_SESSIONS}!A1:G`,
    });

    const sessionRows = data.values || [];

    if (sessionRows.length < 2) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json([]);
    }

    const headers = sessionRows[0];
    const sessions = sessionRows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });

    const result = sessions
      .filter(s => s['Session ID'])
      .map(s => ({
        sessionId: s['Session ID'],
        Program: s['Program'],
        Date: s['Date'],
        Time: s['Time'],
        Location: s['Location'],
        'Max Participants': s['Max Participants'],
        'Birth Year Range': s['Birth Year Range'],
        spotsRemaining: parseInt(s['Max Participants'], 10) || 0,
      }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(result);
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ error: 'Failed to load schedule' });
  }
};
