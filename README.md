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

This pulls credentials from the Vercel dashboard so you don't need to copy any files manually:

```bash
npx vercel env pull .env.local
```

You should see `.env.local` appear in the project root. It will contain `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and the Twilio variables once they have been added to the Vercel dashboard (see step 6).

### 6. Add Twilio environment variables

The SMS notification feature requires a [Twilio](https://twilio.com) account and a purchased phone number. Once you have those, add the following variables to the **Vercel dashboard** under Project → Settings → Environment Variables:

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | From the Twilio console homepage |
| `TWILIO_AUTH_TOKEN` | From the Twilio console homepage |
| `TWILIO_FROM_NUMBER` | The Twilio phone number in E.164 format (e.g. `+16041234567`) |
| `OWNER_PHONE_NUMBER` | The owner's mobile number to receive registration SMS (e.g. `+17781234567`) |

After adding them in Vercel, re-run `npx vercel env pull .env.local` to sync them locally. You can also set them directly in `.env.local` for local testing without going through the dashboard.

### 6. Run the dev server

```bash
npx vercel dev
```

Open [http://localhost:3000/register.html](http://localhost:3000/register.html) in your browser. The calendar should load sessions from Google Sheets.

---

## Troubleshooting

**"Failed to load schedule"** — check the terminal where `vercel dev` is running for a `schedule error:` line. Common causes:

- `.env.local` is missing → re-run `npx vercel env pull .env.local`
- Program sheet tab names don't match exactly → see the Google Sheets structure section below
- Header row is wrong → row 1 of each program tab must be exactly:
  `Session ID`, `Date`, `Time`, `Location`, `Max Participants`, `Birth Year Range`

**Calendar shows no sessions for a program** — the tab was read successfully but has no data rows, or the `Session ID` column is empty for all rows.

**Registration returns "Invalid session"** — the session ID in the sheet doesn't follow the `{SHEET_NAME}-{YYYY}-{MM}-{DD}-{HH}` convention, or the program code prefix doesn't match one of the five valid sheet names.

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
- **Status** — web submissions write `Pending`. Change to `Confirmed` or `Denied` to trigger the parent email (once the Apps Script trigger is set up).
- **Token** — a UUID generated at registration time. Used to authenticate the approve/deny SMS links. Do not edit.

---

## TODO

The following features have been designed but not yet implemented. Each item includes enough context for a developer to pick it up independently.

---

### 1. Fix spots-remaining calculation (Bug)

**File:** `api/schedule.js`

**Problem:** `spotsRemaining` is currently set to `Max Participants` for every session — it never accounts for existing registrations. The calendar always shows full capacity regardless of how many people have signed up.

**Fix:** After fetching all program sessions, fetch the `Registrations` tab and count how many rows have a matching `Session ID` and a `Status` of `Confirmed` or `Pending`. Subtract that count from `Max Participants` to get the real `spotsRemaining`.

```
spotsRemaining = Max Participants − count of rows in Registrations where Session ID matches AND Status is not "Denied"
```

Use `sheets.spreadsheets.values.batchGet` to fetch both the program sheets and the Registrations tab in a single API call for efficiency.

---

### 2. Add Status and Token columns to the Registrations sheet

**Before implementing items 3–5, the Registrations tab needs two new columns:**

| Column | Values | Notes |
|---|---|---|
| `Status` | `Pending` / `Confirmed` / `Denied` | Set to `Pending` on every new web submission. Owner changes this to approve/deny. |
| `Token` | UUID string | A unique token generated at registration time. Used to authenticate approve/deny link taps. |

Updated full column order:

| Timestamp | Session ID | Session Label | Player First | Player Last | Birth Year | Position | Parent Name | Phone | Email | Notes | Paid? | Status | Token |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Update `api/register.js` to write `Pending` and a generated UUID (`crypto.randomUUID()`) when appending the new row.

---

### 3. SMS notification to owner on new registration

**File:** `api/register.js`  
**Service:** [Twilio](https://twilio.com) — requires a Twilio account and a purchased phone number.

After writing the row to the Registrations sheet, send an SMS to the owner's phone number with two one-tap links:

```
New registration: Alex Smith — PEP, Mar 22 @ 3:00 PM
Approve: https://leveledhockey.com/api/approve?token=<TOKEN>
Deny:    https://leveledhockey.com/api/deny?token=<TOKEN>
```

The `<TOKEN>` is the UUID written to the sheet in step 2. It's the only thing that ties the link back to the correct registration row.

**New environment variables to add in Vercel dashboard:**

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | From Twilio console |
| `TWILIO_AUTH_TOKEN` | From Twilio console |
| `TWILIO_FROM_NUMBER` | The Twilio phone number (e.g. `+16041234567`) |
| `OWNER_PHONE_NUMBER` | The owner's mobile number to receive SMS |

---

### 4. Approve and Deny API endpoints

**New files:** `api/approve.js` and `api/deny.js`

These endpoints are hit when the owner taps a link in the SMS. Both follow the same logic:

1. Read the `token` query parameter
2. Scan the `Registrations` sheet for a row whose `Token` column matches
3. If not found or token already used → return 400
4. Update that row's `Status` column to `Confirmed` or `Denied`
5. Read the `Email`, `Player First`, `Player Last`, and `Parent Name` from the same row
6. Send a confirmation or denial email to the parent (see item 5)
7. Return a plain success page the owner sees after tapping the link (e.g. "Alex Smith has been confirmed.")

**Security note:** The token is a UUID and is single-use — once the status has been changed from `Pending`, subsequent taps of the same link should do nothing (or return a friendly "already processed" message).

---

### 5. Parent confirmation/denial email

**Service:** [Resend](https://resend.com) — simple API, generous free tier, works well from Vercel serverless functions.

Triggered from **two places**:

**A. From `api/approve.js` / `api/deny.js`** (owner taps SMS link)  
Send the email directly from the API handler after updating the sheet.

**B. From Google Apps Script** (owner manually edits Status cell in the sheet)  
Add an `onEdit` trigger in the Google Sheet that watches the `Status` column. When it changes to `Confirmed` or `Denied`, send the email using the `Email` value in the same row. The Apps Script uses Gmail or the Resend API (via `UrlFetchApp`) to send.

This dual-trigger ensures the parent always gets an email regardless of whether the owner used the SMS link or edited the sheet directly.

**New environment variables:**

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | From Resend dashboard |
| `EMAIL_FROM` | Sending address, e.g. `info@leveledhockey.com` (must be a verified domain in Resend) |

**Email content (suggested):**

- **Confirmed:** "Your registration for [Player] in [Program] on [Date] has been confirmed. See you on the ice!"
- **Denied:** "Unfortunately, we weren't able to confirm [Player]'s registration for [Program] on [Date]. Please contact us at info@leveledhockey.com if you have questions."

---

### Summary checklist

- [x] Fix `spotsRemaining` bug in `api/schedule.js`
- [x] Add `Status` and `Token` columns to the Registrations sheet
- [x] Update `api/register.js` to write `Status: Pending` and a UUID token
- [x] Update `api/register.js` to send owner SMS via Twilio
- [x] Create `api/review.js` — owner review page with Confirm/Deny buttons
- [x] Create `api/approve.js` — updates sheet Status to Confirmed
- [x] Create `api/deny.js` — updates sheet Status to Denied
- [ ] Parent confirmation/denial email via Resend (`api/approve.js` / `api/deny.js`)
- [ ] Add Apps Script `onEdit` trigger for manual sheet edits
- [ ] Add Twilio environment variables to Vercel dashboard

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