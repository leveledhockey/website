const { google } = require('googleapis');

const SPREADSHEET_ID               = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SCHEDULE_SHEET               = 'Schedule';

function getAuth() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  raw = raw.replace(/\n/g, '\\n');
  const credentials = JSON.parse(raw);
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

    // Fetch the unified schedule sheet and registrations in parallel.
    const [scheduleData, regData] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range:         `${SCHEDULE_SHEET}!A1:G`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
        range:         'Registrations!B1:B10000',
      }),
    ]);

    // Build a map of sessionId → registration count. Every row present is approved.
    const regRows = (regData.data.values || []).slice(1);
    const regCountMap = {};
    regRows.forEach(row => {
      const sessionId = row[0] || '';
      if (sessionId) {
        regCountMap[sessionId] = (regCountMap[sessionId] || 0) + 1;
      }
    });

    const scheduleRows = scheduleData.data.values || [];
    if (scheduleRows.length < 2) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json([]);
    }

    const headers = scheduleRows[0];
    const result  = [];

    scheduleRows.slice(1).forEach(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });

      if (!obj['SessionID']) return;

      const maxParticipants = parseInt(obj['Max Participants'], 10) || 0;
      const registered      = regCountMap[obj['SessionID']] || 0;

      result.push({
        sessionId:          obj['SessionID'],
        Program:            obj['Program'],
        Date:               obj['Date (MM-DD-YY)'],
        Time:               obj['Time (24H clock)'],
        Location:           obj['Location'],
        'Max Participants': obj['Max Participants'],
        'Age Group':        obj['Age Group'],
        spotsRemaining:     Math.max(0, maxParticipants - registered),
      });
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(result);
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ error: 'Failed to load schedule' });
  }
};
