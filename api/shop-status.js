// หน้าเว็บถามว่าเกม/ช่องทางจ่ายไหนเปิดอยู่ (ปิดชั่วคราวได้จากแผงควบคุมที่คอมร้าน)
// offline = ติดต่อคอมร้านไม่ได้ → หน้าเว็บปิดรับเงินทั้งหมด
import { shopStatus } from './_shop.js';

export default async function handler(req, res) {
  const { games, methods, offline, promo, notice, maintenance } = await shopStatus();
  // 21 พ.ย.: ?health=1 ให้ UptimeRobot เช็กจากนอกเครื่อง · คอมร้าน/ngrok/บอทดับ → 503 → เตือน Telegram
  if (req.query?.health) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(offline ? 503 : 200).send(offline ? 'BOSS_DOWN' : 'BOSS_OK');
  }
  // 26 พ.ย.: ngrok หมดโควตา → ให้ Vercel จำคำตอบไว้ 30 วิ ลูกค้ากี่คนก็ถามคอมร้านแค่ ~2 ครั้ง/นาที
  // (ตอนสร้างออเดอร์ checkOpen ยังถามคอมร้านสดทุกครั้ง ปิดร้านแล้วจ่ายไม่ได้แน่นอน)
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');
  return res.status(200).json({ games, methods, offline, promo: offline ? null : promo,
                                notice: offline ? '' : notice || '', maintenance: maintenance || null });
}
