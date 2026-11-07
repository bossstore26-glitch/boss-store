// ลูกค้าใหม่กรอก OTP ที่ส่งไปทาง SMS (เบอร์ทรูมันนี่ที่โอน) หรือขอรหัสใหม่ → ส่งต่อให้บอทที่คอมร้าน
// body: { code: รหัสออเดอร์ 6 ตัว, action: 'verify' | 'resend', otp?: '123456' }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const code = String(req.body?.code ?? '').toUpperCase();
  const action = req.body?.action === 'resend' ? 'resend' : 'verify';
  const otp = String(req.body?.otp ?? '').replace(/\D/g, '');
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ status: 'bad', message: 'รหัสออเดอร์ไม่ถูกต้อง' });
  if (action === 'verify' && otp.length !== 6) return res.status(400).json({ status: 'bad', message: 'กรอกรหัส 6 หลักจาก SMS' });

  const bot = process.env.BOT_URL;
  if (!bot) return res.status(503).json({ status: 'error', message: 'ระบบยังไม่พร้อม กรุณาทักแชทเพจ' });
  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/shop/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ code, action, otp }),
      signal: AbortSignal.timeout(25000),
    });
    const d = await r.json();
    return res.status(200).json({ status: d.status, message: d.message });
  } catch {
    return res.status(503).json({ status: 'error', message: 'เชื่อมต่อร้านไม่ได้ กรุณาลองใหม่ หรือทักแชทเพจ' });
  }
}
