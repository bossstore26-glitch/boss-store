import crypto from 'node:crypto';
import { GAMES, MAX_BAHT, chipsFor, minBaht } from './_rates.js';

// สร้างลิงก์รับเงินทรูมันนี่ (TrueMoney > บริการร้านค้า > สร้างลิงก์รับเงิน)
// ตั้งค่าใน Vercel > Settings > Environment Variables:
//   TMN_LINK_TOKEN       Token ของบริการ "สร้างลิงก์รับเงิน"
//   TMN_RECEIVER_MOBILE  เบอร์ทรูมันนี่ร้านที่รับเงิน 10 หลัก
// ข้อความในลิงก์ "เติมเกมรอยัล|สยาม เพจBOSS STORE (<ไอดีเกม>) #<รหัส>" บอทอ่านจากแจ้งรับเงิน
// แล้วโอนเหรียญเกมนั้นให้ไอดีนี้ (คำว่า "สยาม" = เกม Siam)
const API = 'https://apis.truemoneyservices.com/utils/v1/transfer-link-generator';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ไม่มี 0/O/1/I กันสับสน
const LINK_MINUTES = 30;

function newCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const token = process.env.TMN_LINK_TOKEN;
  const mobile = String(process.env.TMN_RECEIVER_MOBILE || '').trim();
  if (!token || !/^\d{10}$/.test(mobile)) {
    return res.status(503).json({ error: 'ยังไม่เปิดใช้การชำระผ่าน TrueMoney กรุณาใช้ PromptPay' });
  }

  const gameId = String(req.body?.gameId ?? '').trim();
  const amount = Number(req.body?.amount);
  const game = String(req.body?.game ?? 'royal');
  if (!GAMES[game]) {
    return res.status(400).json({ error: 'ไม่รู้จักเกมนี้' });
  }
  if (!/^\d{4,12}$/.test(gameId)) {
    return res.status(400).json({ error: 'ไอดีเกมต้องเป็นตัวเลขเท่านั้น' });
  }
  const min = minBaht(game);
  if (!Number.isInteger(amount) || amount < min || amount > MAX_BAHT) {
    return res.status(400).json({ error: `กรุณาระบุจำนวนเงินเป็นจำนวนเต็ม ${min}–${MAX_BAHT.toLocaleString()} บาท` });
  }

  const chips = chipsFor(amount, game);
  const code = newCode();

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile_number: mobile,
        amount: amount.toFixed(2),
        message: `เติมเกม${GAMES[game].tmnWord} เพจBOSS STORE (${gameId}) #${code}`,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status !== 'ok' || !d.data?.url) {
      console.error('TrueMoney link error:', r.status, d);
      const error = r.status === 429
        ? 'มีผู้ใช้งานพร้อมกันจำนวนมาก กรุณาลองใหม่ในอีก 30 วินาที'
        : 'ไม่สามารถสร้างลิงก์ TrueMoney ได้ กรุณาลองใหม่ หรือใช้ PromptPay';
      return res.status(502).json({ error });
    }
    return res.status(200).json({
      method: 'truemoney',
      id: code,
      url: d.data.url,
      amount,
      chips,
      gameId,
      game,
      expiresAt: Math.floor(Date.now() / 1000) + LINK_MINUTES * 60,
    });
  } catch (err) {
    console.error('TrueMoney link error:', err);
    return res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อ TrueMoney ได้ กรุณาลองใหม่' });
  }
}
