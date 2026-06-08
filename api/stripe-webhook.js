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
          parent_name, phone, email, timestamp } = meta;

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

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    const labelMatch  = (sessionLabel || '').match(/^(.+?) - \d{2}-\d{2}-\d{2,4} at (\d{2}:\d{2})(?::\d{2})? \((.+)\)$/);
    const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : (sessionLabel || '').replace(/_/g, ' ');
    const sessionTime = labelMatch ? formatTime(labelMatch[2]) : '';
    const sessionLoc  = labelMatch ? labelMatch[3] : '';

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
  const { packageId, packageLabel, player_first, player_last, level,
          parent_name, phone, email, timestamp } = meta;

  const amountDollars = `$${(paymentIntent.amount / 100).toFixed(2)} CAD`;

  try {
    const auth = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Write to a separate Summer Registrations sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId:    REGISTRATIONS_SPREADSHEET_ID,
      range:            'Summer Registrations!A:J',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          timestamp || new Date().toISOString(),
          packageId    || '',
          packageLabel || '',
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

    const playerFirst = player_first || '';
    const playerLast  = player_last  || '';
    const parentFirst = (parent_name || '').split(' ')[0];

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        from:    process.env.EMAIL_FROM,
        to:      email,
        subject: `Summer Program Registration Confirmed - ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>${playerFirst} ${playerLast} is registered for the summer program below. Your payment has been received.</p>
               <p><strong>${packageLabel || packageId}</strong></p>
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
