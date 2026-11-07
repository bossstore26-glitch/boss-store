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
    const status = ['paid', 'review', 'delivered'].includes(d.status) ? d.status : 'waiting';
    // otp = ไอดีใหม่ ร้านส่งรหัสยืนยันไปที่เบอร์ทรูมันนี่ที่โอน ให้ลูกค้ากรอกบนหน้านี้
    return res.status(200).json({ status, otp: status === 'review' && !!d.otp, phone: d.phone || null });
  } catch {
    return res.status(200).json({ status: 'unknown' }); // บอทปิดอยู่ ไม่ใช่ความผิดลูกค้า
  }
}
