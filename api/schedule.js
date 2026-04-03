const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// One sheet per program — names must match the tab names in Google Sheets exactly.
const PROGRAM_SHEETS = ['PEP', 'OVERSPEED', 'PUCK_SKILLS', 'BATTLE_CAMP', 'DEFENSE_CAMP'];

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

    // Discover which program sheets actually exist in this spreadsheet.
    const { data: meta } = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties.title',
    });
    const existingSheets = (meta.sheets || [])
      .map(s => s.properties.title)
      .filter(t => PROGRAM_SHEETS.includes(t));

    if (existingSheets.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json([]);
    }

    // Fetch all existing program sheets in a single API call.
    const { data } = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: existingSheets.map(name => `${name}!A1:F`),
    });

    const result = [];

    (data.valueRanges || []).forEach((vr, idx) => {
      const programCode = existingSheets[idx];
      const rows = vr.values || [];
      if (rows.length < 2) return;

      const headers = rows[0];
      rows.slice(1).forEach(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        if (!obj['Session ID']) return;

        result.push({
          sessionId:          obj['Session ID'],
          Program:            programCode,
          Date:               obj['Date'],
          Time:               obj['Time'],
          Location:           obj['Location'],
          'Max Participants': obj['Max Participants'],
          'Birth Year Range': obj['Birth Year Range'],
          spotsRemaining:     parseInt(obj['Max Participants'], 10) || 0,
        });
      });
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(result);
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ error: 'Failed to load schedule' });
  }
};
