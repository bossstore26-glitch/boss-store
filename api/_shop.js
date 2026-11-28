// ถามบอทที่คอมร้าน (ผ่าน ngrok) ว่าเกม/ช่องทางจ่ายไหนเปิดอยู่ (สวิตช์ในแผงควบคุม)
// ไฟล์ขึ้นต้น _ Vercel ไม่ทำเป็น endpoint
// ถามบอทไม่ได้ (คอมร้านไฟดับ/เน็ตหลุด/บอทปิด) → ปิดรับเงินทั้งหมด (offline)
// กันลูกค้าจ่ายเงินแล้วไม่ได้เหรียญ (TrueMoney ไม่ส่งแจ้งเตือนซ้ำ เงินที่เข้าช่วงร้านล่มบอทจะไม่รู้)
// ถามซ้ำ 2 ครั้งก่อนตัดสิน กันเน็ตกระตุกชั่วขณะ
import { GAME_KEYS } from './_rates.js';

export const METHOD_KEYS = ['promptpay', 'truemoney'];
export const METHOD_NAMES = { promptpay: 'PromptPay', truemoney: 'TrueMoney' };

// 24 พ.ย. ร้านสั่ง: ปิดปรับปรุงตามเวลาที่ตั้งไว้ (คอมร้านปิดอยู่ หน้าเว็บอ่านข้อความจากแผงควบคุมไม่ได้ → ฝังไว้ที่นี่)
// ช่วง from–to ปิดรับเงินทุกช่องทางเลย · เลย to แล้วคอมยังไม่กลับมา ก็ยังโชว์ข้อความนี้ต่ออีก GRACE
export const MAINTENANCE = [
  { from: '2026-11-25T05:00:00+07:00', to: '2026-11-25T06:00:00+07:00',
    message: 'ร้านปิดปรับปรุงชั่วคราว 05:00–06:00 น. เปิดร้านแล้วจัดโปรแถม 50,000 เหรียญ ยังไม่มีการเรียกเก็บเงิน' },
];
const MAINT_GRACE_MS = 60 * 60 * 1000;

export function maintenanceNow(now = Date.now(), offline = false) {
  for (const m of MAINTENANCE) {
    const from = Date.parse(m.from), to = Date.parse(m.to);
    if (now >= from && now < to) return m.message;
    if (offline && now >= to && now < to + MAINT_GRACE_MS) return m.message;
  }
  return null;
}

function closedAll(games, methods) {
  for (const k of GAME_KEYS) games[k] = false;
  for (const k of METHOD_KEYS) methods[k] = false;
}

export async function shopStatus() {
  const games = Object.fromEntries(GAME_KEYS.map((k) => [k, true]));
  const methods = Object.fromEntries(METHOD_KEYS.map((k) => [k, true]));
  const bot = process.env.BOT_URL;
  let promo = null; // โปรแถมเหรียญ (ร้านเปิดในแผงควบคุม) หน้าเว็บโชว์ป้าย
  const maint = maintenanceNow();
  if (maint) { // ช่วงปิดปรับปรุง: ไม่ถามคอมร้าน ปิดรับเงินทั้งหมด
    closedAll(games, methods);
    return { games, methods, promo: null, notice: '', known: false, offline: true, maintenance: maint };
  }
  if (!bot) return { games, methods, promo, notice: '', known: false, offline: false }; // ยังไม่ได้ตั้ง BOT_URL ใน Vercel → ไม่บล็อก
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
      // โปรแถมแยกต่อเกม: promo = Royal, promo_siam = Siam → ส่งต่อเป็น { royal, siam } (เฉพาะที่เปิดอยู่)
      const pick = (p) => (p?.on ? { on: true, bonus: Number(p.bonus) || 0, min_baht: Number(p.min_baht) || 0,
                                     scope: p.scope === 'new' ? 'new' : 'all' } : null);
      const royal = pick(d?.promo), siam = pick(d?.promo_siam);
      promo = royal || siam ? { royal, siam } : null;
      const notice = typeof d?.notice === 'string' ? d.notice.slice(0, 200) : ''; // ป้ายประกาศ (แผงควบคุม)
      return { games, methods, promo, notice, known: true, offline: false, sell: d?.sell === true }; // 28 พ.ย. ปุ่มขายเหรียญ
    } catch {}
  }
  // ร้านติดต่อไม่ได้ → ปิดทุกอย่าง
  closedAll(games, methods);
  return { games, methods, promo: null, notice: '', known: false, offline: true, maintenance: maintenanceNow(Date.now(), true) };
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
    return {
      verified: !!d.verified, blocked: !!d.blocked,
      lowVip: !!d.low_vip, vip: Number.isInteger(d.vip) ? d.vip : null, vipMin: Number.isInteger(d.vip_min) ? d.vip_min : 5,
    };
  } catch {
    return { verified: false, blocked: false };
  }
}

export const BLOCKED_MESSAGE = 'ไอดีนี้ถูกระงับการเติม กรุณาติดต่อแอดมินเพจ BOSS STORE';
// 28 พ.ย. ร้านสั่ง: Royal ปรับใหม่ VIP5 ขึ้นไปถึงซื้อขายเหรียญได้
export const lowVipMessage = (info) =>
  `ไอดีนี้ VIP ${info.vip ?? '-'} · เกม Royal ต้อง VIP ${info.vipMin || 5} ขึ้นไปจึงจะรับเหรียญได้`;

// ตรวจก่อนสร้างรายการจ่ายเงิน คืน null ถ้าผ่าน หรือ { status, body } ถ้าปิดอยู่
export async function checkOpen(game, gameName, method) {
  const s = await shopStatus();
  if (s.offline) return { status: 503, body: { error: s.maintenance || OFFLINE_MESSAGE, offline: true } };
  if (!s.methods[method]) return { status: 409, body: { error: methodClosedMessage(method), closedMethod: method } };
  if (!s.games[game]) return { status: 409, body: { error: closedMessage(gameName), closed: game } };
  return null;
}
