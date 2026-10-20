// Shared Fall 2026 Power Edge Pro config — required by api/fall-pep-register.js and
// api/stripe-webhook.js so both endpoints agree on the same set of cohorts (Wednesday
// and Thursday).
//
// As of Oct 2026 the 11-session program is CLOSED (sold out): fall-pep-register.js
// refuses every request, and the Wednesday/Thursday sessions now run as ordinary
// drop-in sessions — api/schedule.js and api/register.js no longer special-case them,
// so each one's capacity is simply its "Max Participants" minus every registration
// against it (full-program registrants included). That means the seats the program
// never sold are now open to drop-ins.
//
// IMPORTANT: WED_LABEL below is written verbatim (via handleFallPepProgram in
// stripe-webhook.js) into the "Session Label" column of already-existing Registrations
// rows for the Wednesday cohort. Do not change it — those historical rows are what
// record who bought the program.
const WED_LABEL = 'Fall 2026 Power Edge Pro — 11-Session Program';

const FALL_PEP_TIME          = '16:00';
const FALL_PEP_DURATION_MIN  = 50;
const FALL_PEP_LOCATION      = 'Scotia Barn Burnaby';
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
  cohort.sessionIds = cohort.dates.map(fallPepSessionId);
});

function getFallPepCohortByPackageId(packageId) {
  return FALL_PEP_COHORTS.find(c => c.packageId === packageId) || null;
}

module.exports = {
  FALL_PEP_TIME,
  FALL_PEP_DURATION_MIN,
  FALL_PEP_LOCATION,
  FALL_PEP_AMOUNT,
  FALL_PEP_COHORTS,
  fallPepSessionId,
  getFallPepCohortByPackageId,
};
