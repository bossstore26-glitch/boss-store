// ก่อนสร้าง QR: ถามบอทว่าไอดีนี้มีในเกมไหม + ภาพตัวละคร (บอทค้นบนจอ "ไอดีรับเหรียญ" ไม่กระทบคิวส่งเหรียญ)
// GET ?game=royal&id=8129121 → { status: found | not_found | busy | unknown | unsupported | limited, image? }
// ถามไม่ได้/ช้าเกิน → unknown (หน้าเว็บให้ไปต่อได้ตามเดิม ไม่ปิดการขาย)
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const game = String(req.query?.game ?? 'royal').toLowerCase();
  const id = String(req.query?.id ?? '').replace(/\D/g, '');
  if (!/^\d{4,12}$/.test(id)) return res.status(200).json({ status: 'not_found' });
  if (game !== 'royal' && game !== 'siam') return res.status(200).json({ status: 'unsupported' });
  const bot = process.env.BOT_URL;
  if (!bot) return res.status(200).json({ status: 'unknown' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try {
    const r = await fetch(
      `${bot.replace(/\/$/, '')}/shop/check-id?game=${encodeURIComponent(game)}&id=${encodeURIComponent(id)}&ip=${encodeURIComponent(ip)}`,
      { headers: { 'ngrok-skip-browser-warning': '1' }, signal: AbortSignal.timeout(40000) },
    );
    const d = await r.json();
    const status = ['found', 'not_found', 'busy', 'unknown', 'unsupported', 'limited'].includes(d.status) ? d.status : 'unknown';
    const image = status === 'found' && /^data:image\/png;base64,/.test(d.image || '') ? d.image : undefined;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status, image });
  } catch {
    return res.status(200).json({ status: 'unknown' });
  }
}
