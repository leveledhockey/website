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

| Timestamp | Session ID | Session Label | Player First | Player Last | Birth Year | Position | Parent Name | Phone | Email | Notes | Paid? | Status | Token |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **Paid?** — web submissions write `FALSE`. Mark `TRUE` manually once payment is received.
- **Status** — web submissions write `Pending`. Use the SMS review link to confirm or deny, which also emails the parent automatically. You can also change this manually in the sheet — see the Apps Script TODO for auto-email on manual edits.
- **Token** — a UUID generated at registration time. Used to authenticate the approve/deny links. Do not edit.

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