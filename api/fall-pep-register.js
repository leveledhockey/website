// Fall 2026 Power Edge Pro — 11-session package. CLOSED: the package can no longer be
// bought, so this endpoint always refuses and never creates a PaymentIntent. The
// individual Wednesday/Thursday sessions are still sold as drop-ins through
// api/register.js, at each session's full capacity (see api/fall-pep-config.js).
//
// The endpoint is kept (rather than deleted) so a stale page still open in someone's
// browser gets a clear "closed" message instead of a 404. handleFallPepProgram in
// stripe-webhook.js is likewise left intact so any PaymentIntent created before the
// close still gets fulfilled if it completes.

const CLOSED_MESSAGE =
  'Full-program registration for the Fall 2026 Power Edge Pro is closed. ' +
  'Individual sessions are still available as drop-ins on the registration page.';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(410).json({ error: CLOSED_MESSAGE });
};
