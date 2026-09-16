// GST is added to every payment collected through the site. Prices shown around the
// page are pre-tax; the amount actually charged (and shown at checkout) has GST added
// on top. Keep this rate in sync with api/gst.js, the server-side copy used when the
// real Stripe charge is created.
const GST_RATE = 0.12;

// Cent-based math so displayed breakdowns always sum exactly (base + gst === total).
function gstPortion(baseDollars) {
  const baseCents = Math.round(baseDollars * 100);
  return Math.round(baseCents * GST_RATE) / 100;
}
function addGst(baseDollars) {
  return Math.round(baseDollars * 100) / 100 + gstPortion(baseDollars);
}
