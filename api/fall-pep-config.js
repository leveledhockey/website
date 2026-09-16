// Shared Fall 2026 Power Edge Pro config — required by api/schedule.js, api/register.js,
// api/fall-pep-register.js, and api/stripe-webhook.js so every endpoint that needs to
// recognize a Fall PEP session, or process a full-program purchase, agrees on the same
// set of cohorts (currently Wednesday and Thursday).
//
// IMPORTANT: WED_LABEL below is written verbatim (via handleFallPepProgram in
// stripe-webhook.js) into the "Session Label" column of already-existing Registrations
// rows for the Wednesday cohort. Do not change it once registrations exist —
// isFallPepProgramLabel() below matches historical rows with startsWith(), and changing
// it later would make existing full-program registrations get miscounted as drop-ins.
const WED_LABEL = 'Fall 2026 Power Edge Pro — 11-Session Program';

const FALL_PEP_TIME          = '16:00';
const FALL_PEP_DURATION_MIN  = 50;
const FALL_PEP_LOCATION      = 'Scotia Barn Burnaby';
const FALL_PEP_PROGRAM_CAP   = 16;   // full-program seats per cohort, per session
const FALL_PEP_DROPIN_CAP    = 4;    // drop-in seats per session
const FALL_PEP_AMOUNT        = 59999; // $599.99 CAD pre-tax, per cohort — GST is added
                                       // on top when the PaymentIntent is created (see
                                       // fall-pep-register.js / gst.js)

function fallPepSessionId(mmddyy) {
  return `PEP_${mmddyy}_${FALL_PEP_TIME}`;
}

const FALL_PEP_COHORTS = [
  {
    packageId: 'fall-pep-2026',
    day:       'Wednesday',
    label:     WED_LABEL,
    dates: [
      '10-07-26', '10-14-26', '10-21-26', '10-28-26',
      '11-04-26', '11-11-26', '11-18-26', '11-25-26', '12-02-26', '12-09-26',
      '12-16-26',
    ],
  },
  {
    packageId: 'fall-pep-2026-thu',
    day:       'Thursday',
    label:     `${WED_LABEL} (Thursday)`,
    dates: [
      '10-08-26', '10-15-26', '10-22-26', '10-29-26',
      '11-05-26', '11-12-26', '11-19-26', '11-26-26', '12-03-26', '12-10-26',
      '12-17-26',
    ],
  },
];

FALL_PEP_COHORTS.forEach(cohort => {
  cohort.sessionIds        = cohort.dates.map(fallPepSessionId);
  cohort.canonicalSessionId = cohort.sessionIds[0];
});

const FALL_PEP_SESSION_IDS = new Set(FALL_PEP_COHORTS.flatMap(c => c.sessionIds));

const SESSION_ID_TO_COHORT = new Map();
FALL_PEP_COHORTS.forEach(cohort => {
  cohort.sessionIds.forEach(id => SESSION_ID_TO_COHORT.set(id, cohort));
});

function isFallPepSession(sessionId) {
  return FALL_PEP_SESSION_IDS.has(sessionId);
}

function getFallPepCohortForSession(sessionId) {
  return SESSION_ID_TO_COHORT.get(sessionId) || null;
}

function getFallPepCohortByPackageId(packageId) {
  return FALL_PEP_COHORTS.find(c => c.packageId === packageId) || null;
}

// Every cohort's label starts with WED_LABEL (the Thursday one appends " (Thursday)"),
// so a single startsWith check identifies any full-program row regardless of cohort.
function isFallPepProgramLabel(label) {
  return String(label || '').startsWith(WED_LABEL);
}

module.exports = {
  FALL_PEP_TIME,
  FALL_PEP_DURATION_MIN,
  FALL_PEP_LOCATION,
  FALL_PEP_PROGRAM_CAP,
  FALL_PEP_DROPIN_CAP,
  FALL_PEP_AMOUNT,
  FALL_PEP_COHORTS,
  FALL_PEP_SESSION_IDS,
  fallPepSessionId,
  isFallPepSession,
  getFallPepCohortForSession,
  getFallPepCohortByPackageId,
  isFallPepProgramLabel,
};
