const { google } = require('googleapis');
const { Resend } = require('resend');
const Stripe = require('stripe');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS = 'Registrations';

const COL_TOKEN         = 11; // L
const COL_PLAYER_FIRST  = 3;  // D
const COL_PLAYER_LAST   = 4;  // E
const COL_LEVEL         = 5;  // F
const COL_PARENT_NAME   = 6;  // G
const COL_SESSION_LABEL = 2;  // C
const COL_EMAIL         = 8;  // I

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

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
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
  const token = paymentIntent.metadata && paymentIntent.metadata.token;

  if (!token) {
    console.error('stripe-webhook: no token in session metadata');
    return res.status(200).json({ received: true });
  }

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

    if (rowIndex === -1) {
      console.error('stripe-webhook: token not found:', token);
      return res.status(200).json({ received: true });
    }

    const row      = dataRows[rowIndex];
    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!J${sheetRow}:K${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody:      { values: [['TRUE', 'Confirmed']] },
    });

    const playerFirst  = row[COL_PLAYER_FIRST]  || '';
    const playerLast   = row[COL_PLAYER_LAST]   || '';
    const parentEmail  = row[COL_EMAIL]         || '';
    const parentName   = row[COL_PARENT_NAME]   || '';
    const sessionLabel = row[COL_SESSION_LABEL] || '';
    const level        = row[COL_LEVEL]         || '';
    const parentFirst  = parentName.split(' ')[0];

    const labelMatch  = sessionLabel.match(/^(.+?) - \d{2}-\d{2}-\d{4} at (\d{2}:\d{2}):\d{2} \((.+)\)$/);
    const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : sessionLabel.replace(/_/g, ' ');
    const sessionTime = labelMatch ? formatTime(labelMatch[2]) : '';
    const sessionLoc  = labelMatch ? labelMatch[3] : '';

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    process.env.EMAIL_FROM,
        to:      parentEmail,
        subject: `Registration Confirmed - ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>Great news! ${playerFirst} ${playerLast}'s registration is confirmed and your payment has been received.</p>
               <p>
                 <strong>Session Name: ${sessionName}</strong><br>
                 <strong>Time: ${sessionTime}</strong><br>
                 <strong>Location: ${sessionLoc}</strong>
               </p>
               <p>Payment of $55.00 CAD was received via credit card / Apple Pay.</p>
               <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
               <p>See you on the ice!<br>Leveled Hockey</p>`,
      });
    } catch (emailErr) {
      console.error('stripe-webhook email error:', emailErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return res.status(200).json({ received: true });
  }
};
