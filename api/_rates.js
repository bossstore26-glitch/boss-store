// ตารางเรทราคา BOSS STORE แยกตามเกม (ใช้ร่วมกันทั้งหน้าเว็บและ API)
// ไฟล์ขึ้นต้นด้วย _ Vercel จะไม่ทำเป็น API endpoint
// ⚠️ ถ้าแก้ตารางนี้ ต้องแก้ RATES ใน "python bot_server.py" ให้ตรงกันด้วย ไม่งั้นบอทจะบล็อกออเดอร์
const M = 1000000;

export const GAMES = {
  royal: {
    key: 'royal',
    name: 'Royal Game',
    short: 'Royal',
    tmnWord: 'รอยัล', // ข้อความโอนทรูมันนี่ "เติมเกมรอยัล เพจBOSS STORE (...)"
    roundTo: 1,
    packages: [
      { baht: 20, chips: 160000 }, { baht: 25, chips: 200000 }, { baht: 30, chips: 240000 },
      { baht: 35, chips: 280000 }, { baht: 40, chips: 320000 }, { baht: 45, chips: 360000 },
      { baht: 50, chips: 400000 }, { baht: 55, chips: 450000 }, { baht: 60, chips: 520000 },
      { baht: 65, chips: 570000 }, { baht: 70, chips: 610000 }, { baht: 75, chips: 670000 },
      { baht: 80, chips: 720000 }, { baht: 85, chips: 760000 }, { baht: 90, chips: 810000 },
      { baht: 95, chips: 870000 }, { baht: 100, chips: 920000 }, { baht: 110, chips: 1000000 },
    ],
  },
  siam: {
    key: 'siam',
    name: 'Siam',
    short: 'Siam',
    tmnWord: 'สยาม',
    roundTo: M, // ช่องจำนวนของ Siam กรอกเป็นหลักล้าน → ปัดลงเป็นล้านเต็ม
    packages: [
      { baht: 25, chips: 20 * M }, { baht: 30, chips: 24 * M }, { baht: 35, chips: 28 * M },
      { baht: 40, chips: 32 * M }, { baht: 45, chips: 36 * M }, { baht: 50, chips: 40 * M },
      { baht: 55, chips: 44 * M }, { baht: 60, chips: 48 * M }, { baht: 65, chips: 52 * M },
      { baht: 70, chips: 56 * M }, { baht: 75, chips: 60 * M }, { baht: 80, chips: 64 * M },
      { baht: 85, chips: 68 * M }, { baht: 90, chips: 72 * M }, { baht: 95, chips: 76 * M },
      { baht: 100, chips: 80 * M }, { baht: 110, chips: 100 * M },
    ],
  },
};
export const GAME_KEYS = Object.keys(GAMES);
export const MAX_BAHT = 50000; // กันกรอกผิดหรือยอดใหญ่ผิดปกติ

// ชื่อเดิม (Royal) เผื่อไฟล์อื่นยังเรียกใช้
export const PACKAGES = GAMES.royal.packages;
export const MIN_BAHT = PACKAGES[0].baht;

export function gameOf(key) {
  return GAMES[key] || GAMES.royal;
}
export function minBaht(key) {
  return gameOf(key).packages[0].baht;
}

// วิธีคิด (เหมือนบอท Telegram / บอทเติมเหรียญ):
// - ยอดตรงแพ็กเกจ → ตามตาราง
// - ยอดระหว่างแพ็กเกจ → เทียบเรทเส้นตรงระหว่าง 2 แพ็กเกจที่ใกล้ที่สุด
// - เกิน 110 บาท → แตกเป็นชุด 110 บาท บวกเรทเศษที่เหลือ (เศษต่ำกว่าแพ็กเกจแรก เทียบเส้นตรงจาก 0)
// - Siam ปัดลงเป็นล้านเต็ม

// ปัดครึ่งขึ้นแบบ Math.round ด้วยจำนวนเต็ม ให้ตรงกับบอท Python
function roundDiv(num, den) {
  return Math.floor((2 * num + den) / (2 * den));
}

function interpolate(baht, lowBaht, lowChips, highBaht, highChips) {
  return lowChips + roundDiv((baht - lowBaht) * (highChips - lowChips), highBaht - lowBaht);
}

function withinTable(baht, packages) {
  if (baht === 0) return 0;
  const exact = packages.find((p) => p.baht === baht);
  if (exact) return exact.chips;
  const first = packages[0];
  if (baht < first.baht) return interpolate(baht, 0, 0, first.baht, first.chips);
  for (let k = 0; k < packages.length - 1; k++) {
    const lo = packages[k];
    const hi = packages[k + 1];
    if (lo.baht <= baht && baht <= hi.baht) return interpolate(baht, lo.baht, lo.chips, hi.baht, hi.chips);
  }
  return 0;
}

export function chipsFor(baht, key = 'royal') {
  const game = GAMES[key];
  if (!game || !Number.isInteger(baht) || baht < game.packages[0].baht || baht > MAX_BAHT) return 0;
  const packages = game.packages;
  const top = packages[packages.length - 1];
  let chips;
  if (baht <= top.baht) {
    chips = withinTable(baht, packages);
  } else {
    const whole = Math.floor(baht / top.baht);
    chips = whole * top.chips + withinTable(baht - whole * top.baht, packages);
  }
  return Math.floor(chips / game.roundTo) * game.roundTo;
}

// แสดงจำนวนเหรียญ: Siam เป็น M, Royal เป็นตัวเลขเต็ม
export function formatChips(chips, key = 'royal') {
  if (key === 'siam') return `${(chips / M).toLocaleString()}M`;
  return chips.toLocaleString();
}

// ข้อความอธิบายวิธีคิด (แสดงใต้ช่องจำนวนเงิน)
export function rateNote(baht, key = 'royal') {
  const game = gameOf(key);
  if (!chipsFor(baht, key)) return '';
  const top = game.packages[game.packages.length - 1];
  if (game.packages.some((p) => p.baht === baht)) return 'ราคาตรงแพ็กเกจ';
  if (baht > top.baht) return `แตกเป็นชุด ${top.baht}฿ = ${formatChips(top.chips, key)} บวกเรทเศษที่เหลือ`;
  return key === 'siam' ? 'เทียบเรทระหว่างแพ็กเกจใกล้เคียง (ปัดลงเป็นล้านเต็ม)' : 'เทียบเรทระหว่างแพ็กเกจใกล้เคียง';
}
