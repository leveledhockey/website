# Leveled Hockey — Development Setup

## Prerequisites

- [Node.js](https://nodejs.org) v22+ (install via [fnm](https://github.com/Schniz/fnm))
- A Vercel account — sign up at vercel.com, then ask to be added as a collaborator on the `leveled-hockey` project
- Access to the Leveled Hockey Google Spreadsheet (shared with the service account — no action needed)

---

## Setup on a new machine

### 1. Install Node.js

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

Close and reopen your terminal, then:

```bash
fnm use --install-if-missing 22
node --version   # should print v22.x.x
```

### 2. Clone the repo

```bash
git clone git@github.com:zhengkerdi/leveled_website.git
cd leveled_website
```

### 3. Install dependencies

```bash
npm install
```

### 4. Log in to Vercel and link the project

```bash
npx vercel login
npx vercel link
```

When `vercel link` asks:
- **Set up and deploy?** → Yes
- **Which scope?** → select your account
- **Link to existing project?** → Yes
- **Project name?** → `leveled-hockey`

### 5. Pull environment variables

This pulls all credentials from the Vercel dashboard so you don't need to copy anything manually:

```bash
npx vercel env pull .env.local
```

`.env.local` will appear in the project root with all the variables listed in the **Environment Variables** section below. If a variable is missing locally, check that it has been added to the Vercel dashboard first, then re-run this command.

### 6. Run the dev server

```bash
npx vercel dev
```

Open [http://localhost:3000/register.html](http://localhost:3000/register.html) in your browser. The calendar should load sessions from Google Sheets.

---

## Environment Variables

All variables must be set in the **Vercel dashboard** under Project → Settings → Environment Variables, enabled for Production, Preview, and Development. After adding or changing any variable, re-run `npx vercel env pull .env.local` to sync locally.

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON credentials for the Google service account |
| `GOOGLE_SPREADSHEET_ID` | ID of the spreadsheet containing program session tabs (PEP, OVERSPEED, etc.) |
| `GOOGLE_REGISTRATIONS_SPREADSHEET_ID` | ID of the separate Registrations spreadsheet |
| `TWILIO_ACCOUNT_SID` | From the [Twilio console](https://console.twilio.com) homepage |
| `TWILIO_AUTH_TOKEN` | From the Twilio console homepage |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number in E.164 format (e.g. `+17406618690`) |
| `OWNER_PHONE_NUMBER` | Owner's mobile number to receive registration SMS (e.g. `+16041234567`) |
| `SITE_URL` | Base URL of the site — `https://leveledhockey.com` in production, `https://leveled-website.vercel.app` for preview |
| `RESEND_API_KEY` | From the [Resend dashboard](https://resend.com) |
| `EMAIL_FROM` | Sending address — must be on a verified domain in Resend (e.g. `info@leveledhockey.com`). Use `onboarding@resend.dev` for testing only. |

> **Note:** `.env` and `.env.local` are git-ignored and should never be committed.

---

## Troubleshooting

**"Failed to load schedule"** — check the terminal where `vercel dev` is running for a `schedule error:` line. Common causes:

- `.env.local` is missing → re-run `npx vercel env pull .env.local`
- Program sheet tab names don't match exactly → see the Google Sheets structure section below
- Header row is wrong → row 1 of each program tab must be exactly:
  `Session ID`, `Date`, `Time`, `Location`, `Max Participants`, `Birth Year Range`

**Calendar shows no sessions for a program** — the tab was read successfully but has no data rows, or the `Session ID` column is empty for all rows.

**Registration returns "Invalid session"** — the session ID in the sheet doesn't follow the `{SHEET_NAME}-{YYYY}-{MM}-{DD}-{HH}` convention, or the program code prefix doesn't match one of the five valid sheet names.

**Registration returns 500 / "Server error"** — check the `vercel dev` terminal for a `register error:` line. Common causes:
- `GOOGLE_REGISTRATIONS_SPREADSHEET_ID` is missing or wrong
- The Registrations sheet tab is not named exactly `Registrations`
- The Registrations sheet is not shared with the service account

**SMS not received after registration** — check the `vercel dev` terminal for an `SMS error:` or `SMS sent:` line. On Twilio trial, SMS only delivers to verified numbers. Verify your number at Twilio Console → Phone Numbers → Verified Caller IDs.

**Approve/deny email not received** — check the terminal for an `email error:` line. While using `onboarding@resend.dev`, Resend only delivers to the email address registered with your Resend account. Use that email when testing registrations.

**Review page returns "Invalid or expired link"** — the token in the URL doesn't match any row in the Registrations sheet. This can happen if `GOOGLE_REGISTRATIONS_SPREADSHEET_ID` points to a different sheet in production vs local, or if the row was deleted.

---

## Google Sheets structure

The site reads from a Google Spreadsheet shared with the service account
`leveled-website@leveledhockey.iam.gserviceaccount.com`.

There is **one tab per program**. The tab names must be exactly as listed below (case-sensitive). The `Registrations` tab is the only other tab the site uses.

### Program tabs

| Tab name | Program displayed on site |
|---|---|
| `PEP` | Power Edge Pro |
| `OVERSPEED` | Overspeed Power Skating |
| `PUCK_SKILLS` | Puck Skills |
| `BATTLE_CAMP` | Battle Camp |
| `DEFENSE_CAMP` | Defense Camp |

Each program tab has this header row (6 columns — no "Program" column):

| Session ID | Date | Time | Location | Max Participants | Birth Year Range |
|---|---|---|---|---|---|
| PEP-2026-04-05-09 | 05-04-2026 | 09:00:00 | NSWC | 16 | 2010-2013 |

**Column rules:**
- **Session ID** — convention: `{TAB_NAME}-{YYYY}-{MM}-{DD}-{HH}`. Set once, never change. Must be unique across the entire sheet. Two sessions on the same day must be at different hours.
- **Date** — format `DD-MM-YYYY`
- **Time** — format `HH:MM:SS` (24-hour)
- **Max Participants** — set to `0` to mark a session as full on the calendar

### Registrations tab

Populated automatically when someone submits the registration form. Columns (do not reorder):

| Col | Letter | Field | Notes |
|---|---|---|---|
| 0 | A | Timestamp | ISO 8601, written by server |
| 1 | B | Session ID | e.g. `PEP-2026-04-05-09` |
| 2 | C | Session Label | Human-readable string, e.g. `PEP - 05-04-2026 at 09:00:00 (NSWC)` |
| 3 | D | Player First | |
| 4 | E | Player Last | |
| 5 | F | Level | U11 / U13 / U15 / U18 |
| 6 | G | Parent Name | |
| 7 | H | Phone | |
| 8 | I | Email | |
| 9 | J | Paid? | `FALSE` on submit; `TRUE` after Stripe payment confirmed by webhook |
| 10 | K | Status | `Pending` (cash/e-transfer) · `Pending Payment` (Stripe, pre-payment) · `Confirmed` · `Denied` |
| 11 | L | Token | UUID. Used to authenticate approve/deny links. Do not edit. |
| 12 | M | Payment Method | `stripe` · `cash` · `etransfer`. Written at registration time. |

- **Paid?** — `FALSE` on all submissions. Set to `TRUE` automatically by the Stripe webhook after a successful payment. For cash/e-transfer, mark `TRUE` manually once payment is received.
- **Status** — Stripe path writes `Pending Payment` initially, then the webhook updates it to `Confirmed`. Cash/e-transfer path writes `Pending`; use the SMS review link to confirm or deny (which also emails the parent). You can also change Status manually — see the Apps Script TODO for auto-email on manual edits.
- **Token** — a UUID generated at registration time. Used to authenticate the approve/deny links and to look up the row from the Stripe webhook. Do not edit.
- **Payment Method** — written at registration time so the owner can see at a glance how each family paid.

---

## TODO

### Completed

- [x] Fix `spotsRemaining` bug in `api/schedule.js` — now calculated live from Registrations sheet on every page load
- [x] Add `Status` and `Token` columns to the Registrations sheet
- [x] `api/register.js` — writes `Status: Pending` and a UUID token on every submission
- [x] `api/register.js` — sends owner an SMS via Twilio with a link to the review page
- [x] `api/review.js` — owner review page showing registration details with Confirm/Deny buttons
- [x] `api/approve.js` / `api/deny.js` — update sheet Status and email the parent via Resend

---

### Remaining

#### 1. Apps Script onEdit trigger (manual sheet edits)

If the owner changes a `Status` cell directly in the Registrations sheet (instead of using the SMS link), no email is sent. An Apps Script `onEdit` trigger can watch column M and fire when the value changes to `Confirmed` or `Denied`.

**How to set it up:**
1. Open the Registrations Google Sheet → **Extensions → Apps Script**
2. Paste the script below and save
3. Run it once manually to grant permissions
4. Go to **Triggers → Add Trigger** → `onEdit`, event type: `From spreadsheet → On edit`

```javascript
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Registrations') return;

  const col = e.range.getColumn();
  const STATUS_COL = 13; // column M
  if (col !== STATUS_COL) return;

  const newStatus = e.value;
  if (newStatus !== 'Confirmed' && newStatus !== 'Denied') return;

  const row       = e.range.getRow();
  const rowData   = sheet.getRange(row, 1, 1, 14).getValues()[0];
  const email     = rowData[9];  // col J
  const firstName = rowData[3];  // col D
  const lastName  = rowData[4];  // col E
  const session   = rowData[2];  // col C

  const subject = newStatus === 'Confirmed'
    ? `Registration Confirmed — ${firstName} ${lastName}`
    : `Registration Update — ${firstName} ${lastName}`;

  const body = newStatus === 'Confirmed'
    ? `Hi,\n\n${firstName} ${lastName}'s registration for ${session} has been confirmed. See you on the ice!\n\n— Leveled Hockey`
    : `Hi,\n\nUnfortunately we weren't able to confirm ${firstName} ${lastName}'s registration for ${session}. Please contact us at info@leveledhockey.com if you have questions.\n\n— Leveled Hockey`;

  GmailApp.sendEmail(email, subject, body);
}
```

> **Note:** This uses Gmail (the account running the script) as the sender. If you'd prefer Resend for consistency, replace `GmailApp.sendEmail` with a `UrlFetchApp.fetch` call to the Resend API using your `RESEND_API_KEY`.

#### 2. Upgrade Twilio from trial

The trial account prepends "Sent from your Twilio trial account" to every SMS and can only send to verified numbers. Once ready for production:
- Upgrade the Twilio account
- The SMS character limit expands — restore the full message in `api/register.js` with both approve and deny links

#### 4. Add Cloudflare Turnstile CAPTCHA to registration form

Without bot protection, a malicious actor could spam the registration form and exhaust the Resend 100 emails/day free limit, blocking real parents from receiving confirmations. Turnstile is free with no usage limits.

**Steps:**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site → choose **Managed**
2. Add the Site Key to `register.html` (widget embed + script tag)
3. Add the Secret Key as `TURNSTILE_SECRET_KEY` in Vercel env vars
4. In `api/register.js`, verify the `cf-turnstile-response` token against Cloudflare's verify API before processing the registration

#### 5. Stripe payment integration

Replace the current manual payment step (e-transfer / cash instructions shown after registration) with an online payment option via **Stripe Checkout** — a Stripe-hosted payment page that automatically shows Apple Pay on Safari/iOS and Google Pay on Chrome/Android. A "Cash or E-transfer" path will still exist and use the current manual approval flow.

> **Account note:** Set up the Stripe account under the business email (`info@leveledhockey.com`) from day one — bank details, KYC verification, and tax documents (1099s) are tied to the account holder. Use test keys (`sk_test_`, `pk_test_`) during development so no real money moves. Swap to live keys only when going to production.

---

##### Overview of the two flows

**Path A — Pay Online (Stripe Checkout / Apple Pay / Google Pay)**

1. User fills out the registration form and selects **"Pay Online"**
2. A clear note is shown: *"You will be redirected to a secure Stripe payment page. Your spot is confirmed immediately upon payment."*
3. User submits the form → `POST /api/register`
4. API writes the row to Sheets: `Status = "Pending Payment"`, `Paid? = FALSE`, `Payment Method = "stripe"`
5. API creates a Stripe Checkout Session and returns `{ stripeUrl }` — **no email sent, no SMS sent at this stage**
6. Frontend JS redirects the browser to `stripeUrl` (Stripe-hosted page)
7. On the Stripe page: Apple Pay button appears automatically on Safari/iOS; Google Pay on Chrome/Android; card form always shown as fallback
8. User completes payment → Stripe redirects back to `SITE_URL/register.html?payment=success`
9. Stripe simultaneously fires a `checkout.session.completed` webhook to `POST /api/stripe-webhook`
10. Webhook verifies the Stripe signature, finds the registration row using the `token` stored in the Checkout Session metadata, sets `Paid? = TRUE` and `Status = "Confirmed"`, then sends **one** confirmation email to the parent mentioning their payment was received
11. No SMS is sent to the owner — the registration is fully self-serve

**Path B — Cash or E-transfer (existing flow, minor copy changes)**

1. User selects **"Cash or E-transfer"**
2. A prominent warning is shown on the form: *"Important: Selecting cash or e-transfer does NOT hold your spot. Your registration is pending until payment is received and approved by the coach."*
3. User submits → `POST /api/register` (existing flow, no changes to logic)
4. Row written: `Status = "Pending"`, `Paid? = FALSE`, `Payment Method = "cash"` or `"etransfer"`
5. **Pending email** sent to parent — updated to explicitly state: *"Your spot is not confirmed. It will be held once payment is received and your registration is approved by the coach."*
6. **SMS sent to owner** with the one-tap review link (unchanged)
7. Owner approves or denies via `/api/review` → **second email** sent (confirmation or denial)

---

##### Files to create / modify

| File | Action | Summary of changes |
|---|---|---|
| `register.html` | Modify | Add payment method radio buttons before the submit button. Show a context-sensitive note under each option. On Stripe path: redirect browser to `stripeUrl` after API responds. Show a success/cancel banner when returning from Stripe (`?payment=success` or `?payment=cancel`). Remove the existing post-submission message about cash/e-transfer being the payment method. |
| `api/register.js` | Modify | Accept new `paymentMethod` field in request body (`'stripe'`, `'cash'`, or `'etransfer'`). Write `Payment Method` as column M. For Stripe: skip email and SMS, create Checkout Session, return `{ stripeUrl }`. For cash/etransfer: update pending email copy, everything else unchanged. |
| `api/stripe-webhook.js` | **Create** | New file. Disable Vercel's default body parser (required for Stripe signature verification). Read raw body from stream, verify with `stripe.webhooks.constructEvent`. Handle `checkout.session.completed`: look up row by token, update `Paid?` and `Status`, send confirmation email. |
| `api/_handleDecision.js` | Modify | The idempotency check currently blocks re-processing any status that isn't `"Pending"`. Since Stripe registrations arrive with `"Pending Payment"`, they will correctly never enter the review flow — no code change needed. However, add a guard so that if the review link is somehow followed for a `"Pending Payment"` row, it shows a clear message rather than an error. |
| `package.json` | Modify | Add `"stripe": "^17.0.0"` |
| `vercel.json` | Modify | Add a function config entry for `api/stripe-webhook.js` to increase `maxDuration` to 15s (webhook processing involves multiple Sheets API calls). |

---

##### register.html — payment method UI

Add these radio buttons inside the form, immediately before the submit button:

```html
<div class="payment-section">
  <p><strong>How would you like to pay?</strong></p>

  <label>
    <input type="radio" name="paymentMethod" value="stripe" required>
    Pay Online (Credit Card / Apple Pay / Google Pay)
    <span class="payment-note">Your spot is confirmed immediately upon payment.</span>
  </label>

  <label>
    <input type="radio" name="paymentMethod" value="cash">
    Cash
    <span class="payment-note warning">
      ⚠️ Your spot is <strong>not held</strong> until payment is received
      and your registration is approved by the coach.
    </span>
  </label>

  <label>
    <input type="radio" name="paymentMethod" value="etransfer">
    E-Transfer (to info@leveledhockey.com)
    <span class="payment-note warning">
      ⚠️ Your spot is <strong>not held</strong> until payment is received
      and your registration is approved by the coach.
    </span>
  </label>
</div>
```

After the API call succeeds, the JS submit handler should branch:

```js
const data = await res.json();

if (data.stripeUrl) {
  // Stripe path — redirect to Stripe Checkout
  window.location.href = data.stripeUrl;
} else {
  // Cash / e-transfer path — show existing success message
  showSuccessMessage();
}
```

On page load, check for `?payment=success` or `?payment=cancel` in the URL and show an appropriate banner:

```js
const params = new URLSearchParams(window.location.search);
if (params.get('payment') === 'success') {
  showBanner('Payment received! Your registration is confirmed. Check your email for details.', 'success');
} else if (params.get('payment') === 'cancel') {
  showBanner('Payment was cancelled. Your registration has not been confirmed. Please try again or choose a different payment method.', 'warning');
}
```

---

##### api/register.js — changes

Add `paymentMethod` to the destructured request body:

```js
const {
  sessionId, player_first, player_last, level,
  parent_name, phone, email, paymentMethod,
} = req.body || {};
```

Validate it:

```js
if (!['stripe', 'cash', 'etransfer'].includes(paymentMethod)) {
  return res.status(400).json({ error: 'Invalid payment method.' });
}
```

Update the row written to Sheets to include column M (Payment Method). The append range becomes `A:M` and the values array gains one entry at the end:

```js
// existing 12 values, plus:
paymentMethod,   // Payment Method (col M, index 12)
```

After writing the row, branch on `paymentMethod`:

**Stripe branch** — create Checkout Session, return URL, skip email and SMS:

```js
if (paymentMethod === 'stripe') {
  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    // Omit payment_method_types — Stripe auto-detects Apple Pay, Google Pay, card
    line_items: [{
      price_data: {
        currency: 'cad',
        unit_amount: 5500,           // $55.00 CAD — update this if price changes
        product_data: {
          name: `Leveled Hockey — ${programCode.replace(/_/g, ' ')}`,
        },
      },
      quantity: 1,
    }],
    mode: 'payment',
    metadata: { token },             // webhook uses this to find the row
    success_url: `${process.env.SITE_URL}/register.html?payment=success`,
    cancel_url:  `${process.env.SITE_URL}/register.html?payment=cancel`,
  });

  return res.status(200).json({ ok: true, stripeUrl: session.url });
}
```

**Cash / e-transfer branch** — existing flow, but update the pending email body to include the explicit warning (see email copy below):

```js
// existing email + SMS logic, with updated email HTML
```

---

##### api/stripe-webhook.js — new file

> **Critical:** Vercel parses request bodies as JSON by default. Stripe signature verification requires the **raw, unparsed body bytes**. Export a `config` object to disable the body parser for this route.

```js
const { google } = require('googleapis');
const { Resend }  = require('resend');
const Stripe      = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const REGISTRATIONS_SPREADSHEET_ID = process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID;
const SHEET_REGISTRATIONS           = 'Registrations';

// Column indices (0-based)
const COL_TOKEN          = 11;  // L
const COL_PAID           = 9;   // J
const COL_STATUS         = 10;  // K
const COL_PLAYER_FIRST   = 3;   // D
const COL_PLAYER_LAST    = 4;   // E
const COL_LEVEL          = 5;   // F
const COL_PARENT_NAME    = 6;   // G
const COL_EMAIL          = 8;   // I
const COL_SESSION_LABEL  = 2;   // C

// MUST export config to disable body parsing — Stripe needs raw bytes for signature verification
module.exports.config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.json({ received: true });
  }

  const { token } = event.data.object.metadata || {};
  if (!token) {
    console.error('Webhook: no token in metadata');
    return res.status(400).send('Missing token in metadata.');
  }

  try {
    const auth   = await getAuth().getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
      range:         `${SHEET_REGISTRATIONS}!A1:M10000`,
    });

    const rows     = data.values || [];
    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex(row => row[COL_TOKEN] === token);

    if (rowIndex === -1) {
      console.error('Webhook: token not found:', token);
      return res.status(404).send('Registration not found.');
    }

    const row      = dataRows[rowIndex];
    const sheetRow = rowIndex + 2; // 1-based + header row

    // Update Paid? (col J) and Status (col K) in a single call
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: REGISTRATIONS_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${SHEET_REGISTRATIONS}!J${sheetRow}`, values: [['TRUE']] },
          { range: `${SHEET_REGISTRATIONS}!K${sheetRow}`, values: [['Confirmed']] },
        ],
      },
    });

    // Send one confirmation email — mention payment was received
    try {
      const resend      = new Resend(process.env.RESEND_API_KEY);
      const playerFirst = row[COL_PLAYER_FIRST]  || '';
      const playerLast  = row[COL_PLAYER_LAST]   || '';
      const parentName  = row[COL_PARENT_NAME]   || '';
      const parentFirst = parentName.split(' ')[0];
      const parentEmail = row[COL_EMAIL]         || '';
      const level       = row[COL_LEVEL]         || '';
      const sessionLabel = row[COL_SESSION_LABEL] || '';

      const labelMatch  = sessionLabel.match(/^(.+?) - \d{2}-\d{2}-\d{4} at (\d{2}:\d{2}):\d{2} \((.+)\)$/);
      const sessionName = labelMatch ? `${labelMatch[1].replace(/_/g, ' ')}${level ? ' - ' + level : ''}` : sessionLabel.replace(/_/g, ' ');
      const sessionTime = labelMatch ? (() => {
        const [h, m] = labelMatch[2].split(':').map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
      })() : '';
      const sessionLoc  = labelMatch ? labelMatch[3] : '';

      await resend.emails.send({
        from:    process.env.EMAIL_FROM,
        to:      parentEmail,
        subject: `Registration Confirmed - ${playerFirst} ${playerLast}`,
        html: `<p>Hi ${parentFirst},</p>
               <p>Great news! ${playerFirst} ${playerLast}'s registration is confirmed and your payment has been received.</p>
               <p>
                 <strong>Session: ${sessionName}</strong><br>
                 <strong>Time: ${sessionTime}</strong><br>
                 <strong>Location: ${sessionLoc}</strong>
               </p>
               <p>Payment of $55.00 CAD was received via credit card / Apple Pay.</p>
               <p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
               <p>See you on the ice!<br>Leveled Hockey</p>`,
      });
    } catch (emailErr) {
      console.error('Webhook confirmation email error:', emailErr);
      // Do not fail the webhook response — sheet is already updated
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return res.status(500).send('Server error.');
  }
};
```

---

##### Updated email copy

**Pending email (cash / e-transfer path) — update in `api/register.js`**

The existing pending email says *"We'll be in touch shortly to confirm your spot."* Replace the body with:

```html
<p>Hi ${parentName},</p>
<p>We've received your registration request for the following session:</p>
<p>
  <strong>Session: ${sessionName}</strong><br>
  <strong>Time: ${sessionTime}</strong><br>
  <strong>Location: ${sessionLoc}</strong>
</p>
<p><strong>⚠️ Important: Your spot is not confirmed yet.</strong><br>
  You selected cash or e-transfer as your payment method. Your registration will only be
  approved once payment is received and confirmed by the coach. You will receive a second
  email when your spot is confirmed.</p>
<p>
  <strong>E-transfer:</strong> Send to info@leveledhockey.com<br>
  <strong>Cash:</strong> Arrange with the coach directly
</p>
<p>If you have any questions, contact us at info@leveledhockey.com or 604-500-6574.</p>
<p>Leveled Hockey</p>
```

**Confirmation email (Stripe path) — in `api/stripe-webhook.js`**

Already shown in the webhook file above. Key additions vs the existing confirmed email template:
- *"your payment has been received"* in the opening line
- *"Payment of $55.00 CAD was received via credit card / Apple Pay."* paragraph

---

##### New environment variables

| Variable | Where to get it | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys | Use `sk_test_...` locally, `sk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → your endpoint → Signing secret | Different for local (Stripe CLI) vs production (Dashboard) |

Add both to Vercel (Production + Preview + Development) and re-run `npx vercel env pull .env.local`.

> **No publishable key needed.** Stripe Checkout is fully server-side — the browser is redirected to `session.url` on Stripe's domain. There is no Stripe.js to load on your site.

---

##### Apple Pay & Google Pay

No extra setup required. Because payment happens on Stripe's hosted domain (`checkout.stripe.com`), Apple Pay domain verification against `leveledhockey.com` is **not needed**. Stripe handles it. Apple Pay will appear automatically for users on Safari (iOS or macOS with Apple Pay set up). Google Pay appears automatically on Chrome/Android. No developer account, no domain association file.

---

##### vercel.json update

Increase the timeout for the webhook handler (it makes multiple Sheets API calls):

```json
{
  "functions": {
    "api/*.js": {
      "memory": 256,
      "maxDuration": 10
    },
    "api/stripe-webhook.js": {
      "memory": 256,
      "maxDuration": 15
    }
  }
}
```

---

##### Step-by-step implementation checklist

**Setup (do once before writing any code)**
- [ ] Create Stripe account at stripe.com under the business email (`info@leveledhockey.com`)
- [ ] In Stripe Dashboard → Developers → API Keys: copy the test secret key (`sk_test_...`)
- [ ] Add `STRIPE_SECRET_KEY=sk_test_...` to Vercel env vars (all environments) and re-run `npx vercel env pull .env.local`
- [ ] Run `npm install stripe` in the project root
- [ ] Confirm the Registrations Google Sheet has a column M header: `Payment Method` (add it manually if not present)

**Local development & testing**
- [ ] `npx vercel dev` — confirm the existing registration flow still works
- [ ] Implement the changes to `register.html` (payment radio buttons, redirect logic, success/cancel banner)
- [ ] Implement the changes to `api/register.js` (accept `paymentMethod`, write col M, Stripe Checkout Session creation)
- [ ] Create `api/stripe-webhook.js`
- [ ] Update `vercel.json` to increase webhook timeout
- [ ] To test the webhook locally, install the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
- [ ] The Stripe CLI prints a webhook signing secret (`whsec_...`) — add it as `STRIPE_WEBHOOK_SECRET` in `.env.local`
- [ ] Test the full Stripe flow:
  - [ ] Submit form with "Pay Online" selected → browser redirects to Stripe Checkout page
  - [ ] Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC
  - [ ] Confirm redirect back to `register.html?payment=success` and success banner appears
  - [ ] Check Registrations sheet: `Status = Confirmed`, `Paid? = TRUE`, `Payment Method = stripe`
  - [ ] Confirm exactly ONE email arrived (no pending email, just the confirmation)
  - [ ] Confirm the confirmation email mentions payment received
  - [ ] Confirm NO SMS was sent to the owner
- [ ] Test the cancellation flow:
  - [ ] Submit form → Stripe page → click Back / Cancel
  - [ ] Confirm redirect to `register.html?payment=cancel` and cancel banner appears
  - [ ] Check sheet: row exists with `Status = Pending Payment`, `Paid? = FALSE` (no cleanup needed — these rows are harmless)
- [ ] Test the cash/e-transfer flow:
  - [ ] Submit form with "Cash" selected
  - [ ] Confirm pending email arrived with the updated warning copy
  - [ ] Confirm SMS sent to owner with review link
  - [ ] Approve via review link → confirm second email (confirmation) arrives
  - [ ] Check sheet: `Status = Confirmed`, `Paid? = FALSE`, `Payment Method = cash`

**Production deployment**
- [ ] In Stripe Dashboard → Webhooks → Add endpoint:
  - URL: `https://leveledhockey.com/api/stripe-webhook`
  - Event: `checkout.session.completed`
- [ ] Copy the production webhook signing secret → add as `STRIPE_WEBHOOK_SECRET` in Vercel env vars (Production only — leave Development pointing at the Stripe CLI secret)
- [ ] Swap `STRIPE_SECRET_KEY` in Vercel Production env to the live key (`sk_live_...`)
- [ ] Deploy to production
- [ ] Do one real end-to-end test in production with a real card (then issue a refund from the Stripe Dashboard)

#### 3. Verify sending domain in Resend

Currently using `onboarding@resend.dev` which can only send to your own Resend account email. Before launch:
- Add and verify `leveledhockey.com` in the Resend dashboard (requires adding DNS records)
- Update `EMAIL_FROM` in Vercel to `info@leveledhockey.com` (or preferred address)

---

## Making a Change
Open a terminal and do the following-

1. Create and switch to a new branch (if you havent already)
`git branch <branch name>` (Creates a new branch)
`git checkout <branch_name>` (switches to new branch)

Verify what branch you're on:
`git branch`

You should see
```
kerdizheng@stinkykz:~/Desktop/leveled_website$ git branch
  dev
  main
* mobile_calendar
```

2. Make your changes

3. See what files have changed
`git status`

You should see:
```
kerdizheng@stinkykz:~/Desktop/leveled_website$ git status
On branch mobile_calendar
Your branch is up to date with 'origin/mobile_calendar'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   register.html
```
The files you've changed should appear under "changes not staged for commit". Add them
`git add <file1> <file2> ...`

4. Commit your changes
`git commit -m "(description of your feature)"`

5. push to origin
`git push`

6. If you open github, you should see your changes.