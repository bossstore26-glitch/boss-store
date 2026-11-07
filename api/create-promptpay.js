import crypto from 'node:crypto';
import { GAMES, MAX_BAHT, chipsFor, minBaht } from './_rates.js';
import { checkOpen, idStatus, BLOCKED_MESSAGE } from './_shop.js';

// พร้อมเพย์ธนาคารของร้าน (ไม่ผ่าน Stripe แล้ว) → ลูกค้าสแกนจ่าย แล้วอัปโหลดสลิป
// บอทที่คอมร้านตรวจสลิปกับ Slip2Go (api/promptpay-slip.js) แล้วส่งเหรียญ
// ตั้งค่าใน Vercel (ไม่ตั้งก็ได้): PROMPTPAY_ID = เบอร์พร้อมเพย์ร้าน 10 หลัก
const PROMPTPAY_ID = String(process.env.PROMPTPAY_ID || '0950871209').replace(/\D/g, '');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ไม่มี 0/O/1/I กันสับสน
const UPLOAD_HOURS = 24; // ตรงกับ PP_UPLOAD_HOURS ในบอท

function newCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

// ---- QR พร้อมเพย์มาตรฐาน EMVCo (Thai QR Payment) ----
function tlv(id, value) {
  return id + String(value.length).padStart(2, '0') + value;
}

function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(id, amount) {
  // เบอร์มือถือ 0812345678 → 0066812345678 (13 หลัก), เลขบัตร/ภาษี 13 หลักใช้ตรงๆ
  const target = id.length === 10 ? '0066' + id.slice(1) : id;
  const account = tlv('00', 'A000000677010111') + tlv(id.length === 10 ? '01' : '02', target);
  const body =
    tlv('00', '01') +
    tlv('01', '12') + // 12 = QR มียอดเงิน (ใช้ครั้งเดียว)
    tlv('29', account) +
    tlv('53', '764') +
    tlv('54', amount.toFixed(2)) +
    tlv('58', 'TH') +
    '6304';
  return body + crc16(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
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
  const closed = await checkOpen(game, GAMES[game].name, 'promptpay');
  if (closed) return res.status(closed.status).json(closed.body);
  const idInfo = await idStatus(game, gameId);
  if (idInfo.blocked) return res.status(403).json({ error: BLOCKED_MESSAGE });

  const chips = chipsFor(amount, game);
  const code = newCode();

  // จดรายการไว้ที่บอทก่อน (บอทใช้เวลาสร้างรายการเช็กว่าสลิปโอนหลังจากนี้ + ยอดตรง)
  const bot = process.env.BOT_URL;
  try {
    const r = await fetch(`${String(bot || '').replace(/\/$/, '')}/shop/pp/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ code, game, gameId, amount }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
  } catch (err) {
    console.error('PromptPay register error:', err);
    return res.status(503).json({ error: 'ระบบพร้อมเพย์ไม่พร้อมชั่วคราว กรุณาลองใหม่ หรือเลือก TrueMoney' });
  }

  return res.status(200).json({
    method: 'promptpay_bank',
    id: code,
    qrData: promptPayPayload(PROMPTPAY_ID, amount),
    amount,
    chips,
    gameId,
    game,
    verified: idInfo.verified, // ไอดีใหม่ → ร้านตรวจก่อนส่งครั้งแรก
    expiresAt: Math.floor(Date.now() / 1000) + UPLOAD_HOURS * 3600,
  });
}
