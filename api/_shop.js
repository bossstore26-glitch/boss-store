// ถามบอทที่คอมร้าน (ผ่าน ngrok) ว่าเกม/ช่องทางจ่ายไหนเปิดอยู่ (สวิตช์ในแผงควบคุม)
// ไฟล์ขึ้นต้น _ Vercel ไม่ทำเป็น endpoint
// ถามบอทไม่ได้ (คอมร้านไฟดับ/เน็ตหลุด/บอทปิด) → ปิดรับเงินทั้งหมด (offline)
// กันลูกค้าจ่ายเงินแล้วไม่ได้เหรียญ (TrueMoney ไม่ส่งแจ้งเตือนซ้ำ เงินที่เข้าช่วงร้านล่มบอทจะไม่รู้)
// ถามซ้ำ 2 ครั้งก่อนตัดสิน กันเน็ตกระตุกชั่วขณะ
import { GAME_KEYS } from './_rates.js';

export const METHOD_KEYS = ['promptpay', 'truemoney'];
export const METHOD_NAMES = { promptpay: 'PromptPay', truemoney: 'TrueMoney' };

export async function shopStatus() {
  const games = Object.fromEntries(GAME_KEYS.map((k) => [k, true]));
  const methods = Object.fromEntries(METHOD_KEYS.map((k) => [k, true]));
  const bot = process.env.BOT_URL;
  if (!bot) return { games, methods, known: false, offline: false }; // ยังไม่ได้ตั้ง BOT_URL ใน Vercel → ไม่บล็อก
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${bot.replace(/\/$/, '')}/shop/status`, {
        headers: { 'ngrok-skip-browser-warning': '1' },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`); // ngrok ตอบเองตอนบอทปิด (502/404)
      const d = await r.json();
      if (!d?.games) throw new Error('bad reply');
      for (const k of GAME_KEYS) {
        if (d.games[k] === false) games[k] = false;
      }
      for (const k of METHOD_KEYS) {
        if (d?.methods && d.methods[k] === false) methods[k] = false;
      }
      return { games, methods, known: true, offline: false };
    } catch {}
  }
  // ร้านติดต่อไม่ได้ → ปิดทุกอย่าง
  for (const k of GAME_KEYS) games[k] = false;
  for (const k of METHOD_KEYS) methods[k] = false;
  return { games, methods, known: false, offline: true };
}

export const OFFLINE_MESSAGE = 'ขออภัย ระบบเติมเหรียญปิดชั่วคราว (กำลังแก้ไข) กรุณาลองใหม่ภายหลัง ยังไม่มีการเรียกเก็บเงิน';

export function closedMessage(name) {
  return `ขออภัย ${name} ปิดรับออเดอร์ชั่วคราว กรุณาลองใหม่ภายหลัง`;
}

export function methodClosedMessage(method) {
  return `ขออภัย ช่องทาง ${METHOD_NAMES[method]} ปิดปรับปรุงชั่วคราว กรุณาเลือกช่องทางอื่น`;
}

// ไอดีนี้ถูกบล็อก / ผูกเบอร์แล้วหรือยัง (กันโกงสามเส้า) ถามไม่ได้ → ถือว่ายังไม่ผูก ไม่บล็อก (บอทเช็กซ้ำตอนเงินเข้า)
export async function idStatus(game, gameId) {
  const bot = process.env.BOT_URL;
  if (!bot) return { verified: false, blocked: false };
  try {
    const r = await fetch(`${bot.replace(/\/$/, '')}/shop/id-status?game=${encodeURIComponent(game)}&id=${encodeURIComponent(gameId)}`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    return { verified: !!d.verified, blocked: !!d.blocked };
  } catch {
    return { verified: false, blocked: false };
  }
}

export const BLOCKED_MESSAGE = 'ไอดีนี้ถูกระงับการเติม กรุณาติดต่อแอดมินเพจ BOSS STORE';

// ตรวจก่อนสร้างรายการจ่ายเงิน คืน null ถ้าผ่าน หรือ { status, body } ถ้าปิดอยู่
export async function checkOpen(game, gameName, method) {
  const s = await shopStatus();
  if (s.offline) return { status: 503, body: { error: OFFLINE_MESSAGE, offline: true } };
  if (!s.methods[method]) return { status: 409, body: { error: methodClosedMessage(method), closedMethod: method } };
  if (!s.games[game]) return { status: 409, body: { error: closedMessage(gameName), closed: game } };
  return null;
}
