import Stripe from 'stripe';
import { MIN_BAHT, MAX_BAHT, chipsFor } from './_rates.js';

// (แบบเก่า หน้าเว็บไม่ได้ใช้แล้ว เก็บไว้สำรอง) เรทราคาอยู่ใน api/_rates.js
const SITE_URL = process.env.SITE_URL || 'https://boss-store-nine.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const gameId = String(req.body?.gameId ?? '').trim();
    const amount = Number(req.body?.amount);

    if (!/^\d{4,12}$/.test(gameId)) {
      return res.status(400).json({ error: 'ไอดีเกมต้องเป็นตัวเลขเท่านั้น' });
    }
    if (!Number.isInteger(amount) || amount < MIN_BAHT || amount > MAX_BAHT) {
      return res.status(400).json({ error: `กรุณาระบุจำนวนเงินเป็นจำนวนเต็ม ${MIN_BAHT}–${MAX_BAHT.toLocaleString()} บาท` });
    }

    // ไม่ใช้ chips จาก req.body เด็ดขาด
    const chips = chipsFor(amount);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['promptpay'],
      line_items: [{
        price_data: {
          currency: 'thb',
          product_data: {
            name: `เติมเหรียญ Royal Game ${chips.toLocaleString()} เหรียญ (ID ${gameId})`,
          },
          unit_amount: amount * 100, // บาท → สตางค์
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: {
        game_id: gameId,
        chips: String(chips),
      },
      success_url: `${SITE_URL}/?payment=success`,
      cancel_url: `${SITE_URL}/?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe Error:', err);
    return res.status(500).json({ error: 'ไม่สามารถสร้างรายการชำระเงินได้ กรุณาลองใหม่' });
  }
}
