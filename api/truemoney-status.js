import { promptPayPayload, PROMPTPAY_ID } from './create-promptpay.js';

const VERIFY_BAHT = 0.1; // ตรงกับ VERIFY_BAHT ในบอท

// หน้าเว็บถามว่าออเดอร์ทรูมันนี่จ่ายแล้วหรือยัง → ถามบอทที่คอมร้าน (ผ่าน ngrok)
// ตั้งค่าใน Vercel: BOT_URL = https://enviable-canyon-verbally.ngrok-free.dev
export default async function handler(req, res) {
  const code = String(req.query?.code ?? '').toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ status: 'bad code' });
  }
  const bot = process.env.BOT_URL;
  if (!bot) return res.status(200).json({ status: 'unknown' });

  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/truemoney/status?code=${code}`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    // review = จ่ายแล้ว แต่ร้านกำลังตรวจก่อนส่ง (ไอดีใหม่ / เบอร์ไม่ตรง)
    // delivered = บอทส่งเหรียญเข้าไอดีเสร็จแล้ว (หน้าเว็บขึ้นป๊อปอัป)
    // checking = พร้อมเพย์: บอทกำลังรอธนาคารยืนยันสลิป / failed = บอทตรวจซ้ำเองแล้วไม่ผ่าน (มี message)
    const status = ['paid', 'review', 'delivered', 'checking', 'failed'].includes(d.status) ? d.status : 'waiting';
    if (status === 'failed') return res.status(200).json({ status, message: d.message || '' });
    // bonus = เหรียญแถมโปรที่บอทส่งไปจริงกับออเดอร์นี้ (โชว์ในป๊อปอัปส่งเสร็จ)
    if (status === 'delivered') return res.status(200).json({ status, bonus: Number(d.bonus) || 0 });
    // verify = ร้านกด 📎 ขอสลิปยืนยัน 0.10 บาท → หน้าเว็บขึ้น QR 0.10 + บันทึกช่วยจำ + ปุ่มอัป (ร้านสั่ง 14 พ.ย.)
    let verify = null;
    if (status === 'review' && d.verify && ['open', 'checking', 'ok', 'bad'].includes(d.verify.state)) {
      verify = {
        state: d.verify.state,
        message: String(d.verify.message || '').slice(0, 300),
        triesLeft: Number(d.verify.triesLeft) || 0,
        qrData: promptPayPayload(PROMPTPAY_ID, VERIFY_BAHT),
        amount: VERIFY_BAHT,
      };
    }
    // otp = ไอดีใหม่ ร้านส่งรหัสยืนยันไปที่เบอร์ทรูมันนี่ที่โอน ให้ลูกค้ากรอกบนหน้านี้
    return res.status(200).json({ status, otp: status === 'review' && !!d.otp, phone: d.phone || null, verify });
  } catch {
    return res.status(200).json({ status: 'unknown' }); // บอทปิดอยู่ ไม่ใช่ความผิดลูกค้า
  }
}
