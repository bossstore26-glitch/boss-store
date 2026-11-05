// ถามบอทที่คอมร้าน (ผ่าน ngrok) ว่าเกม/ช่องทางจ่ายไหนเปิดอยู่ (สวิตช์ในแผงควบคุม)
// ไฟล์ขึ้นต้น _ Vercel ไม่ทำเป็น endpoint
// ถามบอทไม่ได้ (บอทปิด/เน็ตช้า) → ถือว่าเปิดทั้งหมด ไม่ปิดร้านเพราะเหตุนี้ (Stripe ส่งออเดอร์ซ้ำให้เองเมื่อบอทกลับมา)
import { GAME_KEYS } from './_rates.js';

export const METHOD_KEYS = ['promptpay', 'truemoney'];
export const METHOD_NAMES = { promptpay: 'PromptPay', truemoney: 'TrueMoney' };

export async function shopStatus() {
  const games = Object.fromEntries(GAME_KEYS.map((k) => [k, true]));
  const methods = Object.fromEntries(METHOD_KEYS.map((k) => [k, true]));
  const bot = process.env.BOT_URL;
  if (!bot) return { games, methods, known: false };
  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/shop/status`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    for (const k of GAME_KEYS) {
      if (d?.games && d.games[k] === false) games[k] = false;
    }
    for (const k of METHOD_KEYS) {
      if (d?.methods && d.methods[k] === false) methods[k] = false;
    }
    return { games, methods, known: true };
  } catch {
    return { games, methods, known: false };
  }
}

export function closedMessage(name) {
  return `ขออภัย ${name} ปิดรับออเดอร์ชั่วคราว กรุณาลองใหม่ภายหลัง`;
}

export function methodClosedMessage(method) {
  return `ขออภัย ช่องทาง ${METHOD_NAMES[method]} ปิดปรับปรุงชั่วคราว กรุณาเลือกช่องทางอื่น`;
}

// ตรวจก่อนสร้างรายการจ่ายเงิน คืน null ถ้าผ่าน หรือ { status, body } ถ้าปิดอยู่
export async function checkOpen(game, gameName, method) {
  const s = await shopStatus();
  if (!s.methods[method]) return { status: 409, body: { error: methodClosedMessage(method), closedMethod: method } };
  if (!s.games[game]) return { status: 409, body: { error: closedMessage(gameName), closed: game } };
  return null;
}
