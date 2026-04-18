const { google } = require('googleapis');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS           = 'Registrations';

const COL_PLAYER_FIRST  = 3;
const COL_PLAYER_LAST   = 4;
const COL_SESSION_LABEL = 2;
const COL_PARENT_NAME   = 6;
const COL_EMAIL         = 8;
const COL_STATUS        = 10;
const COL_TOKEN         = 11;

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
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { token } = req.query || {};
  if (!token) return res.status(400).send('Missing token.');

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
      range:         `${SHEET_REGISTRATIONS}!A1:L10000`,
    });

    const rows     = data.values || [];
    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex(row => row[COL_TOKEN] === token);

    if (rowIndex === -1) return res.status(400).send('Invalid or expired link.');

    const row           = dataRows[rowIndex];
    const currentStatus = row[COL_STATUS] || '';
    const playerFirst   = row[COL_PLAYER_FIRST]  || '';
    const playerLast    = row[COL_PLAYER_LAST]   || '';
    const parentName    = row[COL_PARENT_NAME]   || '';
    const email         = row[COL_EMAIL]         || '';
    const sessionLabel  = (row[COL_SESSION_LABEL] || '').replace(/_/g, ' ');

    if (currentStatus !== 'Pending') {
      return res.status(200).send(page('Already Processed', `
        <div class="card">
          <div class="name">${playerFirst} ${playerLast}</div>
          <div class="session">${sessionLabel}</div>
          <div class="status status--${currentStatus.toLowerCase()}">
            Already ${currentStatus.toLowerCase()}
          </div>
        </div>
      `));
    }

    return res.status(200).send(page(`New Registration`, `
      <div class="card">
        <div class="label">Player</div>
        <div class="name">${playerFirst} ${playerLast}</div>
        <div class="label">Session</div>
        <div class="session">${sessionLabel}</div>
        <div class="label">Parent</div>
        <div class="meta">${parentName}</div>
        <div class="label">Email</div>
        <div class="meta">${email}</div>
      </div>
      <div class="actions" id="actions">
        <button class="btn btn--confirm" onclick="decide('approve')">Confirm</button>
        <button class="btn btn--deny"    onclick="decide('deny')">Deny</button>
      </div>
      <p id="status-msg" style="display:none;margin-top:1rem;font-size:0.95rem;"></p>
      <script>
        async function decide(action) {
          const label = action === 'approve' ? 'confirm' : 'deny';
          if (!window.confirm('Are you sure you want to ' + label + ' this registration?')) return;
          const btns = document.querySelectorAll('.btn');
          btns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });
          const msg = document.getElementById('status-msg');
          msg.style.display = 'block';
          msg.style.color = '#888';
          msg.textContent = action === 'approve' ? 'Confirming...' : 'Denying...';
          try {
            const resp = await fetch('/api/' + action + '?token=${token}', { method: 'POST' });
            const text = await resp.text();
            if (resp.ok) {
              document.getElementById('actions').style.display = 'none';
              msg.style.color = action === 'approve' ? '#16a34a' : '#dc2626';
              msg.textContent = action === 'approve' ? 'Registration confirmed.' : 'Registration denied.';
            } else {
              msg.style.color = '#dc2626';
              msg.textContent = 'Error: ' + text;
              btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            }
          } catch (e) {
            msg.style.color = '#dc2626';
            msg.textContent = 'Network error. Please try again.';
            btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
          }
        }
      </script>
    `));
  } catch (err) {
    console.error('review error:', err);
    return res.status(500).send('Server error. Please try again.');
  }
};

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Leveled Hockey</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f4f4f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111;
      margin-bottom: 1.25rem;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      margin-bottom: 1.25rem;
    }
    .label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #999;
      margin-top: 1rem;
    }
    .label:first-child { margin-top: 0; }
    .name    { font-size: 1.3rem; font-weight: 700; color: #111; margin-top: 0.2rem; }
    .session { font-size: 0.95rem; color: #444; margin-top: 0.2rem; }
    .meta    { font-size: 0.95rem; color: #444; margin-top: 0.2rem; }
    .status  { font-size: 0.95rem; font-weight: 600; margin-top: 0.75rem; }
    .status--confirmed { color: #16a34a; }
    .status--denied    { color: #dc2626; }
    .actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
      max-width: 400px;
    }
    .btn {
      flex: 1;
      padding: 0.85rem;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn--confirm { background: #16a34a; color: #fff; }
    .btn--confirm:hover { background: #15803d; }
    .btn--deny    { background: #dc2626; color: #fff; }
    .btn--deny:hover    { background: #b91c1c; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}
