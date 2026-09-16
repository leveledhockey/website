// Fall 2026 Power Edge Pro program — shared between index.html and register.html.
// Two cohorts (Wednesday and Thursday), same 11-week format, same pricing. Hard-coded
// to mirror the session IDs entered into the Schedule sheet (PEP_MM-DD-26_16:00) so
// every page agrees on which sessions belong to which cohort. The per-session drop-in
// price is NOT hard-coded here — it's read from the Schedule sheet's Cost column (see
// api/schedule.js / api/register.js), defaulting to $55 if left blank. Only the
// 11-session program package rate is fixed.
//
// Note: Sept 23/30 (Wed) and Sept 24/Oct 1 (Thu) still exist as regular sessions in the
// Schedule sheet — they were dropped from the PEP bundle but not deleted from the sheet.
const FALL_PEP_COHORTS = [
  {
    packageId:     'fall-pep-2026',
    day:           'Wednesday',
    dayPlural:     'Wednesdays',
    time:          '4:00–4:50 PM',
    ageGroup:      'U15–U18',
    ageNote:       'U13 players may email to apply',
    dates: [
      'Oct 7', 'Oct 14', 'Oct 21', 'Oct 28',
      'Nov 4', 'Nov 11', 'Nov 18', 'Nov 25', 'Dec 2', 'Dec 9', 'Dec 16',
    ],
    // Matches the SessionID column written into the Schedule sheet for each date.
    sessionIds: [
      'PEP_10-07-26_16:00', 'PEP_10-14-26_16:00',
      'PEP_10-21-26_16:00', 'PEP_10-28-26_16:00', 'PEP_11-04-26_16:00', 'PEP_11-11-26_16:00',
      'PEP_11-18-26_16:00', 'PEP_11-25-26_16:00', 'PEP_12-02-26_16:00', 'PEP_12-09-26_16:00',
      'PEP_12-16-26_16:00',
    ],
  },
  {
    packageId:     'fall-pep-2026-thu',
    day:           'Thursday',
    dayPlural:     'Thursdays',
    time:          '4:00–4:50 PM',
    ageGroup:      'U11–U13',
    ageNote:       'U9 players may email to apply',
    dates: [
      'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29',
      'Nov 5', 'Nov 12', 'Nov 19', 'Nov 26', 'Dec 3', 'Dec 10', 'Dec 17',
    ],
    sessionIds: [
      'PEP_10-08-26_16:00', 'PEP_10-15-26_16:00',
      'PEP_10-22-26_16:00', 'PEP_10-29-26_16:00', 'PEP_11-05-26_16:00', 'PEP_11-12-26_16:00',
      'PEP_11-19-26_16:00', 'PEP_11-26-26_16:00', 'PEP_12-03-26_16:00', 'PEP_12-10-26_16:00',
      'PEP_12-17-26_16:00',
    ],
  },
];

// Shared across every cohort. Age eligibility differs by cohort — see ageGroup/ageNote
// on each entry in FALL_PEP_COHORTS above.
const FALL_PEP_PROGRAM = {
  name:          'Fall 2026 Power Edge Pro',
  shortName:     'Fall PEP Program',
  location:      'Scotia Barn Burnaby',
  sessionsCount: 11,
  programRate:   599.99,
  amountCents:   59999,
};

const FALL_PEP_SESSION_ID_SET = new Set(FALL_PEP_COHORTS.flatMap(c => c.sessionIds));

const FALL_PEP_SESSION_TO_COHORT = new Map();
FALL_PEP_COHORTS.forEach(cohort => {
  cohort.sessionIds.forEach(id => FALL_PEP_SESSION_TO_COHORT.set(id, cohort));
});

function isFallPepSession(sessionId) {
  return FALL_PEP_SESSION_ID_SET.has(sessionId);
}

function getFallPepCohortForSession(sessionId) {
  return FALL_PEP_SESSION_TO_COHORT.get(sessionId) || null;
}

function getFallPepCohortByPackageId(packageId) {
  return FALL_PEP_COHORTS.find(c => c.packageId === packageId) || null;
}

// Pairs each session ID with its display date and cohort, for building a date picker
// across every cohort (e.g. the drop-in session select).
function getFallPepSessionOptions() {
  return FALL_PEP_COHORTS.flatMap(cohort =>
    cohort.sessionIds.map((sessionId, i) => ({
      sessionId,
      date:   cohort.dates[i],
      cohort,
    }))
  );
}
