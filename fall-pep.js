// Fall 2026 Power Edge Pro program — shared between index.html and register.html.
// Hard-coded to this one 13-week program; mirrors the session IDs entered into the
// Schedule sheet (PEP_MM-DD-26_16:00) so both pages agree on which sessions get the
// Fall PEP drop-in rate ($65 instead of the standard $55).
const FALL_PEP_PROGRAM = {
  packageId:     'fall-pep-2026',
  name:          'Fall 2026 Power Edge Pro',
  shortName:     'Fall PEP Program',
  day:           'Wednesday',
  time:          '4:00–4:50 PM',
  location:      'Scotia Barn Burnaby',
  ageGroup:      'U18',
  sessionsCount: 13,
  dropIn:        65,
  programRate:   699,
  amountCents:      69900,
  dropInAmountCents: 6500,
  dates: [
    'Sept 23', 'Sept 30', 'Oct 7', 'Oct 14', 'Oct 21', 'Oct 28',
    'Nov 4', 'Nov 11', 'Nov 18', 'Nov 25', 'Dec 2', 'Dec 9', 'Dec 16',
  ],
  // Matches the SessionID column written into the Schedule sheet for each date.
  sessionIds: [
    'PEP_09-23-26_16:00', 'PEP_09-30-26_16:00', 'PEP_10-07-26_16:00', 'PEP_10-14-26_16:00',
    'PEP_10-21-26_16:00', 'PEP_10-28-26_16:00', 'PEP_11-04-26_16:00', 'PEP_11-11-26_16:00',
    'PEP_11-18-26_16:00', 'PEP_11-25-26_16:00', 'PEP_12-02-26_16:00', 'PEP_12-09-26_16:00',
    'PEP_12-16-26_16:00',
  ],
};

const FALL_PEP_SESSION_ID_SET = new Set(FALL_PEP_PROGRAM.sessionIds);

function isFallPepSession(sessionId) {
  return FALL_PEP_SESSION_ID_SET.has(sessionId);
}

// Pairs each session ID with its display date, for building a date picker.
function getFallPepSessionOptions() {
  return FALL_PEP_PROGRAM.sessionIds.map((sessionId, i) => ({
    sessionId,
    date: FALL_PEP_PROGRAM.dates[i],
  }));
}
