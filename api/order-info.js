import { promptPayPayload, PROMPTPAY_ID } from './create-promptpay.js';

// 20 พ.ย. ร้านสั่ง: ลิงก์กู้ออเดอร์ ?order=รหัส (ลูกค้าเปิดจากแชท/เบราว์เซอร์อื่นที่ไม่มีออเดอร์ค้างในเครื่อง)
// ถามบอทว่ารหัสนี้มีจริงไหม แล้วคืนข้อมูลรูปแบบเดียวกับ create-promptpay → หน้าเว็บเปิดหน้าชำระเงินเดิม
const UPLOAD_HOURS = 24; // ตรงกับ PP_UPLOAD_HOURS ในบอท
const QR_MINUTES = 10; // ตรงกับ PP_QR_MINUTES ในบอท

export default async function handler(req, res) {
  const code = String(req.query?.code ?? '').toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ found: false });
  const bot = process.env.BOT_URL;
  if (!bot) return res.status(200).json({ found: false });
  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/shop/pp/info?code=${code}`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    const amount = Number(d.amount);
    const created = Number(d.created) || 0;
    if (!d.found || !Number.isFinite(amount) || amount <= 0 || !created) return res.status(200).json({ found: false });
    return res.status(200).json({
      found: true,
      method: 'promptpay_bank',
      id: code,
      qrData: promptPayPayload(PROMPTPAY_ID, amount),
      amount,
      chips: Number(d.chips) || 0,
      gameId: String(d.gameId || ''),
      game: String(d.game || 'royal'),
      bank: '',
      qrExpiresAt: created + QR_MINUTES * 60,
      expiresAt: created + UPLOAD_HOURS * 3600,
    });
  } catch {
    return res.status(200).json({ found: false });
  }
}
