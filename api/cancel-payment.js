import Stripe from 'stripe';

// ยกเลิก QR ที่ยังไม่ได้จ่าย (ปุ่ม "ยกเลิก / แก้ไขยอด") POST { id: "pi_..." }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const id = String(req.body?.id ?? '');
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'bad id' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(id);
    if (intent.metadata?.source !== 'web_qr') {
      return res.status(404).json({ error: 'not found' });
    }
    // ยกเลิกได้เฉพาะที่ยังไม่จ่าย ถ้าจ่ายแล้วบอกหน้าเว็บให้รู้
    if (intent.status === 'requires_action' || intent.status === 'requires_payment_method') {
      await stripe.paymentIntents.cancel(id);
      return res.status(200).json({ status: 'canceled' });
    }
    return res.status(200).json({ status: intent.status });
  } catch (err) {
    console.error('Cancel Error:', err);
    return res.status(500).json({ error: 'ยกเลิกไม่สำเร็จ' });
  }
}
