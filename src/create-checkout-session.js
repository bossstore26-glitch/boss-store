const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { gameId, chips, amount } = req.body;

      // ตรวจสอบความถูกต้องของยอดเงิน
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินให้ถูกต้อง' });
      }

      // สร้าง Checkout Session สำหรับ PromptPay ตามยอดที่ลูกค้ากรอก
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
          game_id: gameId || 'N/A',
          chips: chips || 'N/A'
        },
        success_url: `${req.headers.origin || 'https://promptpay-pay-royal.vercel.app'}/success`,
        cancel_url: `${req.headers.origin || 'https://promptpay-pay-royal.vercel.app'}/cancel`,
      });

      res.status(200).json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
