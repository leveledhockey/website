const { google } = require('googleapis');

const SPREADSHEET_ID               = process.env.GOOGLE_SPREADSHEET_ID;
const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SCHEDULE_SHEET               = 'Schedule';

// Fall 2026 Power Edge Pro — hard capacity partition, no sheet changes: we tell a
// program registration apart from a drop-in registration by the sessionLabel text
// each write already stores (col C), rather than adding a new column.
// When full-program registration closes, bump FALL_PEP_DROPIN_CAP up (e.g. to 20)
// so the unsold program seats become available as drop-in.
const FALL_PEP_LABEL        = 'Fall 2026 Power Edge Pro — 13-Session Program';
const FALL_PEP_PROGRAM_CAP  = 16;
const FALL_PEP_DROPIN_CAP   = 4;
const FALL_PEP_CANONICAL_SESSION_ID = 'PEP_09-23-26_16:00';
const FALL_PEP_SESSION_IDS = new Set([
  'PEP_09-23-26_16:00', 'PEP_09-30-26_16:00', 'PEP_10-07-26_16:00', 'PEP_10-14-26_16:00',
  'PEP_10-21-26_16:00', 'PEP_10-28-26_16:00', 'PEP_11-04-26_16:00', 'PEP_11-11-26_16:00',
  'PEP_11-18-26_16:00', 'PEP_11-25-26_16:00', 'PEP_12-02-26_16:00', 'PEP_12-09-26_16:00',
  'PEP_12-16-26_16:00',
]);
function isFallPepProgramLabel(label) {
  return String(label || '').startsWith(FALL_PEP_LABEL);
}

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
        range:         `${SCHEDULE_SHEET}!A1:H`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
        range:         'Registrations!B1:C10000',
      }),
    ]);

    // Build a map of sessionId → registration count. Every row present is approved.
    const regRows = (regData.data.values || []).slice(1);
    const regCountMap = {};
    const fallPepDropinCountMap = {};
    let fallPepProgramCount = 0;
    regRows.forEach(row => {
      const sessionId = row[0] || '';
      const label     = row[1] || '';
      if (!sessionId) return;

      regCountMap[sessionId] = (regCountMap[sessionId] || 0) + 1;

      if (FALL_PEP_SESSION_IDS.has(sessionId)) {
        if (isFallPepProgramLabel(label)) {
          // One full-program purchase writes an identical row to all 13 sessions —
          // count it once, off a single canonical session, to avoid a 13x overcount.
          if (sessionId === FALL_PEP_CANONICAL_SESSION_ID) fallPepProgramCount++;
        } else {
          fallPepDropinCountMap[sessionId] = (fallPepDropinCountMap[sessionId] || 0) + 1;
        }
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
      const isFallPep       = FALL_PEP_SESSION_IDS.has(obj['SessionID']);

      // Fall PEP sessions run a hard capacity partition: only FALL_PEP_DROPIN_CAP of
      // the 20 seats are ever sold as drop-in, regardless of how many program spots
      // go unsold — so spotsRemaining here reflects the drop-in pool only.
      const spotsRemaining = isFallPep
        ? Math.max(0, FALL_PEP_DROPIN_CAP - (fallPepDropinCountMap[obj['SessionID']] || 0))
        : Math.max(0, maxParticipants - registered);

      const sessionResult = {
        sessionId:          obj['SessionID'],
        Program:            obj['Program'],
        Date:               obj['Date (MM-DD-YY)'],
        Time:               obj['Time (24H clock)'],
        EndTime:            obj['End Time (24H clock)'],
        Location:           obj['Location'],
        'Max Participants': obj['Max Participants'],
        'Age Group':        obj['Age Group'],
        spotsRemaining,
      };

      if (isFallPep) {
        sessionResult.fallPepProgramSpotsRemaining = Math.max(0, FALL_PEP_PROGRAM_CAP - fallPepProgramCount);
      }

      result.push(sessionResult);
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(result);
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ error: 'Failed to load schedule' });
  }
};
