const Stripe = require('stripe');

const SUMMER_PACKAGES = {
  'sat-over-aug': {
    label:    'Saturday Overspeed — August 2026',
    abbrev:   'OVERSPEED',
    amount:   22500,
    dates:    ['August 1', 'August 8', 'August 15', 'August 22', 'August 29'],
    time:     null,
    location: 'Canlan Sports North Shore',
    timeOverrides: {
      'August 22': {
        '3:00–3:50 PM': '3:30–4:20 PM',
        '4:00–4:50 PM': '4:30–5:20 PM',
        '5:00–5:50 PM': '5:30–6:20 PM',
      },
    },
  },
  'sun-pep-aug': {
    label:    'Sunday Power Edge Pro — August 2026',
    abbrev:   'PEP',
    amount:   22500,
    dates:    ['August 2', 'August 9', 'August 16', 'August 23', 'August 30'],
    time:     null,
    location: 'Canlan Sports North Shore',
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { packageId, player_first, player_last, level, birth_year, parent_name, phone, email, time_slot, mailList } = req.body || {};

  const requiredFields = { packageId, player_first, player_last, birth_year, parent_name, phone, email };
  if (Object.values(requiredFields).some(v => !v || !String(v).trim())) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const pkg = SUMMER_PACKAGES[String(packageId).trim()];
  if (!pkg) {
    return res.status(400).json({ error: 'Invalid package selection.' });
  }

  const sessionTime = time_slot ? String(time_slot).trim() : (pkg.time || '');

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      pkg.amount,
      currency:    'cad',
      description: pkg.label,
      metadata: {
        type:          'summer_package',
        packageId:     String(packageId).trim(),
        packageLabel:  pkg.label,
        abbrev:        pkg.abbrev || '',
        dates:         pkg.dates.join(','),
        sessionTime:   sessionTime,
        location:      pkg.location || '',
        timeOverrides: pkg.timeOverrides ? JSON.stringify(pkg.timeOverrides) : '',
        player_first:  String(player_first).trim(),
        player_last:   String(player_last).trim(),
        level:         String(level || '').trim(),
        birthYear:     String(birth_year).trim(),
        parent_name:   String(parent_name).trim(),
        phone:         String(phone).trim(),
        email:         String(email).trim(),
        mailList:      mailList === 'true' ? 'true' : 'false',
        timestamp:     new Date().toISOString(),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('summer-register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
