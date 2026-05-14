module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');
  res.status(200).json({ stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
};
