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

| Timestamp | Session ID | Session Label | Player First | Player Last | Birth Year | Position | Parent Name | Phone | Email | Notes | Paid? |
|---|---|---|---|---|---|---|---|---|---|---|---|

All web submissions write `FALSE` in the `Paid?` column. Mark as `TRUE` manually once payment is received.

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