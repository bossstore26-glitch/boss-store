import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const { gameId, chips, amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินให้ถูกต้อง' });
      }

      // กำหนดโดเมนหลักของเว็บไซต์ (ดึงจาก Request หรือใช้ค่าเริ่มต้น)
      const host = req.headers.host || 'boss-store-nine.vercel.app';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const domain = `${protocol}://${host}`;

      // สร้าง Checkout Session สำหรับ PromptPay
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['promptpay'],
        line_items: [{
          price_data: {
            currency: 'thb',
            product_data: { 
              name: `เติมชิป Royal Game (${chips || 'Custom'} ชิป)`,
            },
            unit_amount: Math.round(amount * 100), // แปลงบาทเป็นสตางค์
          },
          quantity: 1,
        }],
        mode: 'payment',
        metadata: {
          game_id: String(gameId || 'N/A'),
          chips: String(chips || 'N/A')
        },
        success_url: `${domain}/?payment=success`,
        cancel_url: `${domain}/?payment=cancel`,
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
