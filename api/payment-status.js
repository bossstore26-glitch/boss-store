import Stripe from 'stripe';

// หน้าเว็บถามสถานะทุกไม่กี่วินาที: GET /api/payment-status?id=pi_...
// ตอบแค่สถานะ ไม่ส่งข้อมูลอื่นของรายการออกไป
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const id = String(req.query?.id ?? '');
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'bad id' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(id);
    if (intent.metadata?.source !== 'web_qr') {
      return res.status(404).json({ error: 'not found' });
    }
    // succeeded = จ่ายแล้ว, requires_action = รอสแกน, canceled = ยกเลิก/หมดเวลา
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: intent.status });
  } catch (err) {
    console.error('Status Error:', err);
    return res.status(500).json({ error: 'ตรวจสถานะไม่ได้' });
  }
}
