import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { gameId, chips, amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินให้ถูกต้อง' });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['promptpay'],
        line_items: [{
          price_data: {
            currency: 'thb',
            product_data: { 
              name: `เติมชิป Royal Game (${chips || 'Custom'} ชิป)`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        metadata: {
          game_id: gameId || 'N/A',
          chips: String(chips || 'N/A')
        },
        success_url: `${req.headers.origin || 'https://boss-store-nine.vercel.app'}/success`,
        cancel_url: `${req.headers.origin || 'https://boss-store-nine.vercel.app'}/cancel`,
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Stripe Error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
}
