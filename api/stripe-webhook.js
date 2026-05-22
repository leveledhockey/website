const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');
const Stripe = require('stripe');

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS = 'Registrations';

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
  const meta = paymentIntent.metadata || {};

  const { sessionId, sessionLabel, player_first, player_last, level,
          parent_name, phone, email, timestamp } = meta;

  if (!sessionId || !email) {
    console.error('stripe-webhook: missing metadata fields');
    return res.status(200).json({ received: true });
  }

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Write the confirmed registration row now that payment has succeeded.
    // Column order: A=Timestamp B=SessionID C=SessionLabel D=PlayerFirst E=PlayerLast
    //               F=Level G=ParentName H=Phone I=Email J=Paid K=Status L=PaymentIntentId
    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            `${SHEET_REGISTRATIONS}!A:L`,
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
          'TRUE',
          'Confirmed',
          paymentIntent.id,
        ]],
      },
    });

    const playerFirst  = player_first  || '';
    const playerLast   = player_last   || '';
    const parentEmail  = email;
    const parentName   = parent_name   || '';
    const parentFirst  = parentName.split(' ')[0];

    const labelMatch  = sessionLabel.match(/^(.+?) - \d{2}-\d{2}-\d{2,4} at (\d{2}:\d{2})(?::\d{2})? \((.+)\)$/);
    const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : sessionLabel.replace(/_/g, ' ');
    const sessionTime = labelMatch ? formatTime(labelMatch[2]) : '';
    const sessionLoc  = labelMatch ? labelMatch[3] : '';

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
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
               <p>Payment of $55.00 CAD was received successfully.</p>
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
