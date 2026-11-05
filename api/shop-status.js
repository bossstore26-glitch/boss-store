// หน้าเว็บถามว่าเกม/ช่องทางจ่ายไหนเปิดอยู่ (ปิดชั่วคราวได้จากแผงควบคุมที่คอมร้าน)
// offline = ติดต่อคอมร้านไม่ได้ → หน้าเว็บปิดรับเงินทั้งหมด
import { shopStatus } from './_shop.js';

export default async function handler(req, res) {
  const { games, methods, offline } = await shopStatus();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ games, methods, offline });
}
