import Stripe from 'stripe';
import { MIN_BAHT, MAX_BAHT, chipsFor } from './_rates.js';

// สร้าง QR PromptPay ให้แสดงบนหน้าเว็บเราเอง (ไม่ต้องเด้งไปหน้า Stripe)
// เรทราคาอยู่ใน api/_rates.js (คำนวณที่ server เท่านั้น ห้ามเชื่อค่าจากหน้าเว็บ)
// PromptPay บังคับต้องมีอีเมล ลูกค้าไม่ต้องกรอก ใช้อีเมลร้านแทน
const BILLING_EMAIL = process.env.PROMPTPAY_BILLING_EMAIL || 'bossstore26@gmail.com';

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

    const intent = await stripe.paymentIntents.create({
      amount: amount * 100, // บาท → สตางค์
      currency: 'thb',
      payment_method_types: ['promptpay'],
      payment_method_data: {
        type: 'promptpay',
        billing_details: { email: BILLING_EMAIL },
      },
      confirm: true,
      description: `เติมเหรียญ Royal Game ${chips.toLocaleString()} เหรียญ (ID ${gameId})`,
      // บอทอ่าน game_id / chips จากตรงนี้ (event payment_intent.succeeded)
      metadata: {
        game_id: gameId,
        chips: String(chips),
        source: 'web_qr',
      },
    });

    const qr = intent.next_action?.promptpay_display_qr_code;
    if (!qr?.data) {
      console.error('PromptPay QR missing:', intent.id, intent.status, intent.next_action);
      return res.status(500).json({ error: 'ไม่สามารถสร้าง QR ได้ กรุณาลองใหม่' });
    }

    return res.status(200).json({
      id: intent.id,
      amount,
      chips,
      gameId,
      qrData: qr.data,            // ข้อความ EMVCo ใช้วาด QR เองบนหน้าเว็บ
      qrImage: qr.image_url_png,  // รูปสำรองจาก Stripe
      expiresAt: qr.expires_at,   // unix seconds
    });
  } catch (err) {
    console.error('Stripe Error:', err);
    return res.status(500).json({ error: 'ไม่สามารถสร้างรายการชำระเงินได้ กรุณาลองใหม่' });
  }
}
