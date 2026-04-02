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

This pulls the Google credentials from the Vercel dashboard so you don't need to copy any files manually:

```bash
npx vercel env pull .env.local
```

You should see `.env.local` appear in the project root containing `GOOGLE_SPREADSHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`.

### 6. Run the dev server

```bash
npx vercel dev
```

Open [http://localhost:3000/register.html](http://localhost:3000/register.html) in your browser. The schedule table should load sessions from Google Sheets.

---

## Troubleshooting

**"Failed to load schedule"** — check the terminal where `vercel dev` is running for a `schedule error:` line. Common causes:

- `.env.local` is missing → re-run `npx vercel env pull .env.local`
- Sheet tab is not named `Sessions` exactly (capital S) → rename it in Google Sheets
- Header row is wrong → row 1 of the Sessions tab must be exactly:
  `Session ID`, `Program`, `Date`, `Time`, `Location`, `Max Participants`, `Birth Year Range`

**"No sessions scheduled at this time"** — the Sessions sheet exists and was read successfully, but either it has no data rows or the `Session ID` column is empty.

---

## Google Sheets structure

The site reads from a Google Spreadsheet shared with the service account
`leveled-website@leveledhockey.iam.gserviceaccount.com`.

**Sessions tab** — the business owner edits this to manage the schedule:

| Session ID | Program | Date | Time | Location | Max Participants | Birth Year Range |
|---|---|---|---|---|---|---|
| PEP-2026-03-22-03 | PEP | 22-03-2026 | 03:00:00 | NSWC | 20 | 2010-2015 |

- Session ID convention: `{program}-{YYYY}-{MM}-{DD}-{HH}` — set once, never change
- Date format: `DD-MM-YYYY`
- Time format: `HH:MM:SS` (24-hour)

**Registrations tab** — to be added later. Will be populated automatically when someone registers via the website, with `Paid? = FALSE` for all web submissions.

---

## Deploying to production

Vercel auto-deploys on every push to `main`:

```bash
git add .
git commit -m "your message"
git push
```

To update environment variables, go to the Vercel dashboard → Project → Settings → Environment Variables. After changing them, re-run `npx vercel env pull .env.local` locally to sync.

---

## What is and isn't in the repo

| Committed | Not committed (gitignored) |
|---|---|
| `api/schedule.js` — serverless function | `.env.local` — credentials |
| `api/register.js` — serverless function | `.env` — credentials |
| `package.json` — declares dependencies | `*SheetsAPIKey.json` — raw API key file |
| `vercel.json` — function config | `node_modules/` — installed by `npm install` |
| All HTML/CSS/images | `.vercel/` — machine-specific project link |
