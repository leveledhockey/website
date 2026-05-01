Leveled Hockey — Developer Reference

---

# 1. Local Development Setup

## Prerequisites

- [Node.js](https://nodejs.org) v22+ — install via [fnm](https://github.com/Schniz/fnm):
  ```bash
  curl -fsSL https://fnm.vercel.app/install | bash
  # Reopen terminal, then:
  fnm use --install-if-missing 22
  node --version  # should print v22.x.x
  ```
- A Vercel account — sign up at vercel.com, then ask to be added as a collaborator on the `leveled-hockey` project

## Steps

**1. Install**
```bash
npm install
```

**2. Link to Vercel project**
```bash
npx vercel login
npx vercel link
```
When prompted:
- Set up and deploy? → **Yes**
- Which scope? → select your account
- Link to existing project? → **Yes**
- Project name? → `leveled-hockey`

**3. Pull environment variables**
```bash
npx vercel env pull .env.local
```
This pulls all credentials from the Vercel dashboard into `.env.local`. Never commit this file — it is git-ignored. If a variable is missing, add it in the Vercel dashboard first, then re-run this command.

**4. Start the dev server**
```bash
npx vercel dev
```
Open [http://localhost:3000/register.html](http://localhost:3000/register.html). The calendar should load sessions from Google Sheets.

# 2. Google Sheets Structure

The site reads from two separate Google Spreadsheets, both shared with the service account `leveled-website@leveledhockey.iam.gserviceaccount.com`.

## Schedule Spreadsheet — Schedule Tab

A single flat tab containing all programs. **Header row (row 1) — must be exactly these 7 columns:**

| Program | Date (MM-DD-YY) | Time (24H clock) | Location | Max Participants | Age Group | SessionID |
|---|---|---|---|---|---|---|
| PEP | 05-02-26 | 9:00 | NSWC | 16 | U13 | PEP_05-02-26_09:00 |
| PUCK SKILLS | 05-09-26 | 9:00 | NSWC | 16 | U15 | PUCKSKILLS_05-09-26_09:00 |
| BATTLE CAMP | 05-10-26 | 10:00 | NSWC | 20 | U11 | BATTLECAMP_05-10-26_10:00 |

**Column rules:**
- **Program** — display name of the program. Valid values: `PEP`, `OVERSPEED`, `PUCK SKILLS`, `BATTLE CAMP`, `DEFENSE CAMP`
- **Date** — format `MM-DD-YY` (e.g. `05-02-26`)
- **Time** — format `H:MM` or `HH:MM`, 24-hour clock, no seconds (e.g. `9:00`, `13:00`)
- **Location** — rink name (e.g. `NSWC`, `Canlan North Van`)
- **Max Participants** — set to `0` to mark a session as full on the calendar
- **Age Group** — values: `U9`, `U11`, `U13`, `U15`
- **SessionID** — format: `{PROGRAMCODE}_{MM-DD-YY}_{HH:MM}`. Program code is the program name with spaces removed (e.g. `PUCK SKILLS` → `PUCKSKILLS`, `BATTLE CAMP` → `BATTLECAMP`, `DEFENSE CAMP` → `DEFENSECAMP`). Set once, never change. Must be unique — two sessions on the same day for the same program must use different times.

## Registrations Spreadsheet — `Registrations` Tab

Populated automatically when someone submits the registration form. Do not reorder columns.

| Col | Field | Notes |
|---|---|---|
| A | Timestamp | ISO 8601, written by server |
| B | Session ID | e.g. `PEP_05-02-26_09:00` |
| C | Session Label | Human-readable, e.g. `PEP - 05-02-26 at 9:00 (NSWC)` |
| D | Player First | |
| E | Player Last | |
| F | Level | U9 / U11 / U13 / U15 / U18 |
| G | Parent Name | |
| H | Phone | |
| I | Email | |
| J | Paid? | `FALSE` on submit; `TRUE` after Stripe payment confirmed by webhook. For cash/e-transfer, mark `TRUE` manually. |
| K | Status | `Pending` (cash/e-transfer, awaiting approval) · `Pending Payment` (Stripe, pre-payment) · `Confirmed` · `Denied` |
| L | Token | UUID generated at registration. Used to authenticate approve/deny links. Do not edit. |
| M | Payment Method | `stripe` · `cash` · `etransfer`. Written at registration time. |


### Manually Adding Registration
Fill out "Session ID", "Player First", and "Player Last" in the Registrations excel. You can leave all other fields blank. The site will automatically recognize the registration if you do it manually.
---

# 3. Services

## Vercel
**Purpose:** Hosts the website and runs all serverless API functions (`api/*.js`). Handles deployments from GitHub — every push to `main` auto-deploys to production; every PR gets a unique preview URL.

**Cost:** Free (Hobby plan). Includes 100 GB bandwidth/month and serverless function execution within generous limits. Upgrade to Pro ($20 USD/month) if bandwidth or execution limits are exceeded.

---

## GitHub
**Purpose:** Source control and collaboration. The Vercel integration watches this repo and triggers deployments automatically.

**Cost:** Free.

---

## Google Sheets + Google Cloud (Sheets API)
**Purpose:** Acts as the database. The Schedule spreadsheet stores session data that populates the calendar. The Registrations spreadsheet stores every registration submission. A Google Cloud service account authenticates the server's read/write calls.

**Cost:** Free. The Sheets API has a limit of 300 read requests per minute, which is far more than this site needs.

---

## Resend
**Purpose:** Sends transactional emails to parents — a pending email when they register via cash/e-transfer, and a confirmation or denial email when the owner approves or denies the registration.

**Cost:** Free tier — 100 emails/day, 3,000/month. Pro plan is $20 USD/month for 50,000 emails/month if needed. The free tier is sufficient for current volume.

**Important:** The sending domain `leveledhockey.com` must be verified in the Resend dashboard (requires adding DNS records). Until then, use `onboarding@resend.dev` for testing — it can only deliver to the email registered with your Resend account.

---

## Twilio
**Purpose:** Sends an SMS to the owner after every cash/e-transfer registration, containing a one-tap link to the review page to approve or deny.

**Cost:** Pay-as-you-go. Phone number rental ~$1.15 USD/month. Outbound SMS to Canadian numbers ~$0.0085 USD/message. At low volume (a few dozen registrations per season), cost is negligible.

**Note:** The trial account prepends "Sent from your Twilio trial account" to every SMS and can only deliver to verified numbers. Upgrade the account before launch to remove these restrictions.

---

## Stripe *(not yet implemented)*
**Purpose:** Handles online payments at registration — Stripe Checkout supports credit card, Apple Pay, and Google Pay. A webhook updates the registration record automatically when payment is confirmed.

**Cost:** No monthly fee. Per-transaction fee: **2.9% + $0.30 CAD** per successful charge (standard Canadian rate). On a $55 session, Stripe keeps ~$1.90; the remainder is deposited to the linked bank account.

**Note:** Use test keys (`sk_test_...`) during development. Switch to live keys (`sk_live_...`) in the Vercel Production environment only when ready to accept real payments.

---

## Cloudflare Turnstile *(not yet implemented)*
**Purpose:** CAPTCHA protection on the registration form to prevent bots from spamming submissions and exhausting the Resend free-tier email limit.

**Cost:** Free, no usage limits.
