// ลูกค้าอัปโหลดสลิปพร้อมเพย์ → ส่งต่อให้บอทที่คอมร้านตรวจกับ Slip2Go
// body: { code: รหัสรายการ 6 ตัว, image: 'data:image/jpeg;base64,...' (หน้าเว็บย่อภาพให้แล้ว) }
// ตอบ: { status: paid | review | rejected | retry | locked | busy | bad | error, message }
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const code = String(req.body?.code ?? '').toUpperCase();
  const image = String(req.body?.image ?? '');
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ status: 'bad', message: 'รหัสรายการไม่ถูกต้อง' });
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 4_000_000) {
    return res.status(400).json({ status: 'retry', message: 'กรุณาเลือกไฟล์ภาพสลิป (JPG/PNG)' });
  }

  const bot = process.env.BOT_URL;
  if (!bot) return res.status(503).json({ status: 'error', message: 'ระบบยังไม่พร้อม กรุณาทักแชทเพจ' });
  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/shop/pp/slip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      // IP ลูกค้า ให้บอทจำกัดจำนวนครั้ง/บล็อกคนอัปโหลดมั่ว (กันเผาโทเคน Slip2Go)
      body: JSON.stringify({ code, image, ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() }),
      signal: AbortSignal.timeout(45000),
    });
    const d = await r.json();
    return res.status(200).json({ status: d.status, message: d.message, triesLeft: d.tries_left });
  } catch {
    return res.status(503).json({
      status: 'error',
      message: 'เชื่อมต่อร้านไม่ได้ชั่วคราว กรุณาลองอัปโหลดใหม่อีกครั้ง หรือทักแชทเพจพร้อมสลิป',
    });
  }
}
