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

async function addToMailingList(sheets, email) {
  if (!EMAIL_SPREADSHEET_ID) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId:    EMAIL_SPREADSHEET_ID,
    range:            `${SHEET_EMAILS}!A:B`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[new Date().toISOString(), email.trim().toLowerCase()]],
    },
  });
}

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
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

const MONTH_NUM = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
};

// "July 7"  → "07-07-26"
function summerDateToId(dateStr) {
  const [monthName, day] = dateStr.trim().split(' ');
  const mm = String(MONTH_NUM[monthName] || 0).padStart(2, '0');
  const dd = String(parseInt(day, 10)).padStart(2, '0');
  return `${mm}-${dd}-26`;
}

// "3:00–3:50 PM" → "15:00"   "2:45–3:35 PM" → "14:45"
function summerTimeTo24h(timeStr) {
  const startPart = timeStr.split(/[–\-]/)[0].trim();        // "3:00" or "2:45"
  const isPM      = /pm/i.test(timeStr);
  const [hStr, mStr = '0'] = startPart.replace(/[apm]/gi, '').trim().split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

  // Route to the appropriate handler based on registration type
  if (meta.type === 'summer_package') {
    return handleSummerPackage(paymentIntent, meta, res);
  }
  return handleDropIn(paymentIntent, meta, res);
};

async function handleDropIn(paymentIntent, meta, res) {
  const { sessionId, sessionLabel, player_first, player_last, level,
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
      try { await addToMailingList(sheets, email); } catch (e) { console.error('mailing list write error:', e); }
    }

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    const labelMatch  = (sessionLabel || '').match(/^(.+?) - (\d{2}-\d{2}-\d{2,4}) at (\d{2}:\d{2})(?::\d{2})? \((.+)\)$/);
    const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : (sessionLabel || '').replace(/_/g, ' ');
    const sessionDate = labelMatch ? formatDate(labelMatch[2]) : '';
    const sessionTime = labelMatch ? formatTime(labelMatch[3]) : '';
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
               <p>Payment of $55.00 CAD was received successfully.</p>
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

async function handleSummerPackage(paymentIntent, meta, res) {
  const { packageId, packageLabel, abbrev, dates: datesStr, sessionTime, location,
          timeOverrides: timeOverridesStr,
          player_first, player_last, level, parent_name, phone, email, mailList, timestamp } = meta;

  const dates         = (datesStr || '').split(',').map(d => d.trim()).filter(Boolean);
  const timeOverrides = timeOverridesStr ? JSON.parse(timeOverridesStr) : {};
  const amountDollars = `$${(paymentIntent.amount / 100).toFixed(2)} CAD`;

  function resolveTime(date) {
    return (timeOverrides[date] && sessionTime && timeOverrides[date][sessionTime])
      ? timeOverrides[date][sessionTime]
      : sessionTime;
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // One row per session date, written into the shared Registrations sheet
    const rows = dates.map((date, i) => {
      const dateTime  = resolveTime(date);
      const timeCode  = dateTime ? summerTimeTo24h(dateTime) : '';
      const sessionId = abbrev && timeCode
        ? `${abbrev}_${summerDateToId(date)}_${timeCode}`
        : `${packageId}-${i + 1}`;
      const timeInfo     = dateTime ? ` at ${dateTime}` : '';
      const locInfo      = location ? ` (${location})`  : '';
      const sessionLabel = `${packageLabel} - ${date}, 2026${timeInfo}${locInfo}`;
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
      try { await addToMailingList(sheets, email); } catch (e) { console.error('mailing list write error:', e); }
    }

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    try {
      const sessionsHtml = dates.map((date, i) => {
        const dateTime = resolveTime(date);
        return `
        <p>
          <strong>Session ${i + 1}:</strong> ${date}<br>
          ${dateTime ? `Time: ${dateTime}<br>` : ''}
          ${location ? `Location: ${location}` : ''}
        </p>`;
      }).join('');

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        from:    process.env.EMAIL_FROM,
        to:      email,
        subject: `Summer Program Registration Confirmed — ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>${playerFirst} ${playerLast} is registered for the summer program below. Your payment has been received.</p>
               <p><strong>${packageLabel || packageId}</strong></p>
               ${sessionsHtml}
               <p>Payment of ${amountDollars} was received successfully.</p>
               <p>We'll see you on the ice! If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
               <p>Leveled Hockey Development</p>`,
      });
    } catch (emailErr) {
      console.error('stripe-webhook summer email error:', emailErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook summer error:', err);
    return res.status(200).json({ received: true });
  }
};
