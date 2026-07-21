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

  const { email, childName, birthYear } = req.body || {};
  const trimmed      = String(email || '').trim().toLowerCase();
  const trimmedName  = String(childName || '').trim();
  const trimmedYear  = String(birthYear || '').trim();

  if (!trimmed || !trimmed.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!trimmedName) {
    return res.status(400).json({ error: "Please enter your child's name." });
  }
  if (!/^\d{4}$/.test(trimmedYear)) {
    return res.status(400).json({ error: "Please enter your child's birth year." });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId:    EMAIL_SPREADSHEET_ID,
      range:            `${EMAIL_SHEET}!A:C`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[trimmed, trimmedName, trimmedYear]],
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
