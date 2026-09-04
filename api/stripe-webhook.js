const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');
const Stripe = require('stripe');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const EMAIL_SPREADSHEET_ID          = process.env.GOOGLE_EMAIL_SPREADSHEET_ID;
const SHEET_REGISTRATIONS = 'Registrations';
const SHEET_EMAILS        = 'emails';

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

async function addToMailingList(sheets, email, childName, birthYear) {
  if (!EMAIL_SPREADSHEET_ID) return;

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedYear  = (birthYear || '').trim();

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: EMAIL_SPREADSHEET_ID,
    range:         `${SHEET_EMAILS}!A:C`,
  });
  const rows = existing.data.values || [];
  const isDuplicate = rows.some(row =>
    String(row[0] || '').trim().toLowerCase() === trimmedEmail &&
    String(row[2] || '').trim() === trimmedYear
  );
  if (isDuplicate) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId:    EMAIL_SPREADSHEET_ID,
    range:            `${SHEET_EMAILS}!A:C`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[trimmedEmail, (childName || '').trim(), trimmedYear]],
    },
  });
}

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// "MM-DD-YY" → "Wednesday, July 10, 2026"
function formatDate(mmddyy) {
  const [mm, dd, yy] = mmddyy.split('-').map(Number);
  const year = yy < 100 ? 2000 + yy : yy;
  const d = new Date(year, mm - 1, dd);
  return `${DOW_NAMES[d.getDay()]}, ${MONTH_NAMES[mm - 1]} ${dd}, ${year}`;
}

// Fall 2026 Power Edge Pro — 13-session package. Hard-coded: a single, fixed-schedule
// program (Wednesdays, Sept 23 - Dec 16, 4:00-4:50 PM at Scotia Barn Burnaby).
const FALL_PEP_LABEL       = 'Fall 2026 Power Edge Pro — 13-Session Program';
const FALL_PEP_TIME        = '16:00';
const FALL_PEP_DURATION_MIN = 50;
const FALL_PEP_LOCATION    = 'Scotia Barn Burnaby';
const FALL_PEP_DATES    = [
  '09-23-26', '09-30-26', '10-07-26', '10-14-26', '10-21-26', '10-28-26',
  '11-04-26', '11-11-26', '11-18-26', '11-25-26', '12-02-26', '12-09-26', '12-16-26',
];
function fallPepSessionId(mmddyy) {
  return `PEP_${mmddyy}_${FALL_PEP_TIME}`;
}

// Disable body parser — Stripe needs raw bytes for signature verification
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method not allowed');
  }

  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).end(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  const paymentIntent = event.data.object;
  const meta = paymentIntent.metadata || {};

  if (!meta.email) {
    console.error('stripe-webhook: missing email in metadata');
    return res.status(200).json({ received: true });
  }

  if (meta.type === 'fall_pep_program') {
    return handleFallPepProgram(paymentIntent, meta, res);
  }
  return handleDropIn(paymentIntent, meta, res);
};

async function handleDropIn(paymentIntent, meta, res) {
  const { sessionId, sessionLabel, sessionEndTime, player_first, player_last, level, birthYear,
          parent_name, phone, email, mailList, timestamp } = meta;

  if (!sessionId) {
    console.error('stripe-webhook drop-in: missing sessionId');
    return res.status(200).json({ received: true });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          timestamp || new Date().toISOString(),
          sessionId,
          sessionLabel || '',
          player_first || '',
          player_last  || '',
          level        || '',
          parent_name  || '',
          phone        || '',
          email,
          paymentIntent.id,
        ]],
      },
    });

    if (mailList === 'true') {
      try {
        await addToMailingList(sheets, email, `${player_first || ''} ${player_last || ''}`.trim(), birthYear);
      } catch (e) { console.error('mailing list write error:', e); }
    }

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    const labelMatch  = (sessionLabel || '').match(/^(.+?) - (\d{2}-\d{2}-\d{2,4}) at (\d{2}:\d{2})(?::\d{2})? \((.+)\)$/);
    const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : (sessionLabel || '').replace(/_/g, ' ');
    const sessionDate = labelMatch ? formatDate(labelMatch[2]) : '';
    const sessionEnd  = sessionEndTime || (labelMatch ? addMinutes(labelMatch[3], 60) : '');
    const sessionTime = labelMatch ? `${formatTime(labelMatch[3])} - ${formatTime(sessionEnd)}` : '';
    const sessionLoc  = labelMatch ? labelMatch[4] : '';

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        from:    process.env.EMAIL_FROM,
        to:      email,
        subject: `Registration Confirmed - ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>Great news! ${playerFirst} ${playerLast}'s registration is confirmed and your payment has been received.</p>
               <p>
                 <strong>Session Name: ${sessionName}</strong><br>
                 <strong>Date: ${sessionDate}</strong><br>
                 <strong>Time: ${sessionTime}</strong><br>
                 <strong>Location: ${sessionLoc}</strong>
               </p>
               <p>Payment of $${(paymentIntent.amount / 100).toFixed(2)} CAD was received successfully.</p>
               <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
               <p>See you on the ice!<br>Leveled Hockey</p>`,
      });
    } catch (emailErr) {
      console.error('stripe-webhook email error:', emailErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook drop-in error:', err);
    return res.status(200).json({ received: true });
  }
}

async function handleFallPepProgram(paymentIntent, meta, res) {
  const { player_first, player_last, level, birthYear, parent_name, phone, email, mailList, timestamp } = meta;

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // One row per session date, written into the shared Registrations sheet —
    // matches how drop-in registrations are recorded, one row per session.
    const rows = FALL_PEP_DATES.map(date => {
      const sessionId    = fallPepSessionId(date);
      const sessionLabel = `${FALL_PEP_LABEL} - ${date} at ${FALL_PEP_TIME} (${FALL_PEP_LOCATION})`;
      return [
        timestamp || new Date().toISOString(),
        sessionId,
        sessionLabel,
        player_first || '',
        player_last  || '',
        level        || '',
        parent_name  || '',
        phone        || '',
        email,
        paymentIntent.id,
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody:      { values: rows },
    });

    if (mailList === 'true') {
      try {
        await addToMailingList(sheets, email, `${player_first || ''} ${player_last || ''}`.trim(), birthYear);
      } catch (e) { console.error('mailing list write error:', e); }
    }

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    try {
      const sessionsHtml = FALL_PEP_DATES.map((date, i) => `
        <p>
          <strong>Session ${i + 1}:</strong> ${formatDate(date)}<br>
          Time: ${formatTime(FALL_PEP_TIME)} - ${formatTime(addMinutes(FALL_PEP_TIME, FALL_PEP_DURATION_MIN))}<br>
          Location: ${FALL_PEP_LOCATION}
        </p>`).join('');

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        from:    process.env.EMAIL_FROM,
        to:      email,
        subject: `Fall PEP Program Registration Confirmed: ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>${playerFirst} ${playerLast} is registered for the Fall 2026 Power Edge Pro 13-session program. Your payment has been received.</p>
               <p><strong>${FALL_PEP_LABEL}</strong></p>
               ${sessionsHtml}
               <p>Payment of $${(paymentIntent.amount / 100).toFixed(2)} CAD was received successfully.</p>
               <p>We'll see you on the ice! If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
               <p>Leveled Hockey Development</p>`,
      });
    } catch (emailErr) {
      console.error('stripe-webhook fall-pep email error:', emailErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook fall-pep error:', err);
    return res.status(200).json({ received: true });
  }
}
