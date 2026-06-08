const Stripe = require('stripe');

const SUMMER_PACKAGES = {
  'tue-puck-jul': {
    label:    'Tuesday Puck Skills — July 2026',
    abbrev:   'PUCK',
    amount:   13000,
    dates:    ['July 7', 'July 14', 'July 21'],
    time:     '2:45–3:35 PM',
    location: 'Canlan Sports North Shore',
  },
  'thu-def-jul': {
    label:    'Thursday Defensive Skills — July 2026',
    abbrev:   'DEF',
    amount:   13000,
    dates:    ['July 9', 'July 16', 'July 23'],
    time:     '2:45–3:35 PM',
    location: 'Canlan Sports North Shore',
  },
  'sat-over-jul': {
    label:    'Saturday Overspeed — July 2026',
    abbrev:   'OVER',
    amount:   15000,
    dates:    ['July 11', 'July 18', 'July 25'],
    time:     null,
    location: 'Canlan Sports North Shore',
  },
  'sat-over-aug': {
    label:    'Saturday Overspeed — August 2026',
    abbrev:   'OVER',
    amount:   22500,
    dates:    ['Aug 1', 'Aug 8', 'Aug 15', 'Aug 22', 'Aug 29'],
    time:     null,
    location: 'Canlan Sports North Shore',
    timeOverrides: {
      'Aug 22': {
        '3:00–3:50 PM': '3:30–4:20 PM',
        '4:00–4:50 PM': '4:30–5:20 PM',
        '5:00–5:50 PM': '5:30–6:20 PM',
      },
    },
  },
  'sun-pep-jul': {
    label:    'Sunday Power Edge Pro — July 2026',
    abbrev:   'PEP',
    amount:   15000,
    dates:    ['July 12', 'July 19', 'July 26'],
    time:     null,
    location: 'Canlan Sports North Shore',
  },
  'sun-pep-aug': {
    label:    'Sunday Power Edge Pro — August 2026',
    abbrev:   'PEP',
    amount:   22500,
    dates:    ['Aug 2', 'Aug 9', 'Aug 16', 'Aug 23', 'Aug 30'],
    time:     null,
    location: 'Canlan Sports North Shore',
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { packageId, player_first, player_last, level, parent_name, phone, email, time_slot } = req.body || {};

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
        parent_name:   String(parent_name).trim(),
        phone:         String(phone).trim(),
        email:         String(email).trim(),
        timestamp:     new Date().toISOString(),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('summer-register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
