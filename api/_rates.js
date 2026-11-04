// ตารางเรทราคา BOSS STORE (ใช้ร่วมกันทั้งหน้าเว็บและ API)
// ไฟล์ขึ้นต้นด้วย _ Vercel จะไม่ทำเป็น API endpoint
// ⚠️ ถ้าแก้ตารางนี้ ต้องแก้ PACKAGES ใน "python bot_server.py" ให้ตรงกันด้วย ไม่งั้นบอทจะบล็อกออเดอร์
export const PACKAGES = [
  { baht: 20, chips: 160000 },
  { baht: 25, chips: 200000 },
  { baht: 30, chips: 240000 },
  { baht: 35, chips: 280000 },
  { baht: 40, chips: 320000 },
  { baht: 45, chips: 360000 },
  { baht: 50, chips: 400000 },
  { baht: 55, chips: 450000 },
  { baht: 60, chips: 520000 },
  { baht: 65, chips: 570000 },
  { baht: 70, chips: 610000 },
  { baht: 75, chips: 670000 },
  { baht: 80, chips: 720000 },
  { baht: 85, chips: 760000 },
  { baht: 90, chips: 810000 },
  { baht: 95, chips: 870000 },
  { baht: 100, chips: 920000 },
  { baht: 110, chips: 1000000 },
];

export const MIN_BAHT = PACKAGES[0].baht; // 20
export const MAX_BAHT = 50000;            // กันกรอกผิดหรือยอดใหญ่ผิดปกติ

// เหมือนบอท Telegram (truemoney-webhook/server.js) ทุกอย่าง:
// - ยอดตรงแพ็กเกจ → ตามตาราง
// - ยอดระหว่างแพ็กเกจ → เทียบเรทเส้นตรงระหว่าง 2 แพ็กเกจที่ใกล้ที่สุด เช่น 61 บาท = 530,000
// - เกิน 110 บาท → แตกเป็นชุด 110 บาท (=1M) บวกเรทเศษที่เหลือ เช่น 128 บาท = 1,144,000
//   (เศษต่ำกว่า 20 บาท เทียบเส้นตรงจาก 0 บาท = 0 เหรียญ)

// ปัดครึ่งขึ้นแบบ Math.round ด้วยจำนวนเต็ม ให้ตรงกับบอท Python
function roundDiv(num, den) {
  return Math.floor((2 * num + den) / (2 * den));
}

function interpolate(baht, lowBaht, lowChips, highBaht, highChips) {
  return lowChips + roundDiv((baht - lowBaht) * (highChips - lowChips), highBaht - lowBaht);
}

function withinTable(baht) {
  if (baht === 0) return 0;
  const exact = PACKAGES.find((p) => p.baht === baht);
  if (exact) return exact.chips;
  const first = PACKAGES[0];
  if (baht < first.baht) return interpolate(baht, 0, 0, first.baht, first.chips);
  for (let k = 0; k < PACKAGES.length - 1; k++) {
    const lo = PACKAGES[k];
    const hi = PACKAGES[k + 1];
    if (lo.baht <= baht && baht <= hi.baht) return interpolate(baht, lo.baht, lo.chips, hi.baht, hi.chips);
  }
  return 0;
}

export function chipsFor(baht) {
  if (!Number.isInteger(baht) || baht < MIN_BAHT || baht > MAX_BAHT) return 0;
  const top = PACKAGES[PACKAGES.length - 1];
  if (baht <= top.baht) return withinTable(baht);
  const whole = Math.floor(baht / top.baht);
  return whole * top.chips + withinTable(baht - whole * top.baht);
}

// ข้อความอธิบายวิธีคิด (แสดงใต้ช่องจำนวนเงิน)
export function rateNote(baht) {
  if (!chipsFor(baht)) return '';
  if (PACKAGES.some((p) => p.baht === baht)) return 'ราคาตรงแพ็กเกจ';
  if (baht > PACKAGES[PACKAGES.length - 1].baht) return 'แตกเป็นชุด 110฿ = 1M บวกเรทเศษที่เหลือ';
  return 'เทียบเรทระหว่างแพ็กเกจใกล้เคียง';
}
