// GST is added to every payment collected through the site. Keep this rate in sync
// with gst.js, the client-side copy used for on-page price previews.
const GST_RATE = 0.12;

function gstPortionCents(baseCents) {
  return Math.round(baseCents * GST_RATE);
}
function addGstCents(baseCents) {
  return baseCents + gstPortionCents(baseCents);
}

module.exports = { GST_RATE, gstPortionCents, addGstCents };
