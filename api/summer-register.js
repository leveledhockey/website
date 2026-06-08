const Stripe = require('stripe');

// Allowed summer packages with their CAD amounts in cents
const SUMMER_PACKAGES = {
  'tue-puck-jul':  { label: 'Tuesday Puck Skills — July 2026',          amount: 13000 },
  'thu-def-jul':   { label: 'Thursday Defensive Skills — July 2026',     amount: 13000 },
  'sat-over-jul':  { label: 'Saturday Overspeed — July 2026',            amount: 15000 },
  'sat-over-aug':  { label: 'Saturday Overspeed — August 2026',          amount: 22500 },
  'sun-pep-jul':   { label: 'Sunday Power Edge Pro — July 2026',         amount: 15000 },
  'sun-pep-aug':   { label: 'Sunday Power Edge Pro — August 2026',       amount: 22500 },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { packageId, player_first, player_last, level, parent_name, phone, email } = req.body || {};

  const required = { packageId, player_first, player_last, parent_name, phone, email };
  if (Object.values(required).some(v => !v || !String(v).trim())) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const pkg = SUMMER_PACKAGES[String(packageId).trim()];
  if (!pkg) {
    return res.status(400).json({ error: 'Invalid package selection.' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      pkg.amount,
      currency:    'cad',
      description: pkg.label,
      metadata: {
        type:         'summer_package',
        packageId:    String(packageId).trim(),
        packageLabel: pkg.label,
        player_first: String(player_first).trim(),
        player_last:  String(player_last).trim(),
        level:        String(level || '').trim(),
        parent_name:  String(parent_name).trim(),
        phone:        String(phone).trim(),
        email:        String(email).trim(),
        timestamp:    new Date().toISOString(),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('summer-register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
