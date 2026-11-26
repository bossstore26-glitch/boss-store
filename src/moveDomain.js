// 26 พ.ย. 2569 ร้านสั่ง: ย้ายลูกค้าไปเว็บใหม่ www.bossstore.net (ลิงก์เดิมยังเปิดได้ แต่จะพาไปเว็บใหม่)
// ข้อมูลที่ลูกค้าจำไว้ (บัญชีธนาคาร / ไอดีล่าสุด / ออเดอร์ค้างจ่าย / ธีม / ภาษา) อยู่ในเครื่องลูกค้า ผูกกับชื่อเว็บ
// → เว็บเดิมแนบข้อมูลไปกับลิงก์ส่วน # (ไม่ถูกส่งไปเซิร์ฟเวอร์) · เว็บใหม่รับแล้วลบออกจากแถบที่อยู่ทันที
export const NEW_HOST = 'www.bossstore.net';
export const OLD_HOST = 'boss-store-nine.vercel.app';
const PREFIX = 'bossstore_';
const TAG = 'bsmove=';

function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

// เว็บเดิม: เก็บข้อมูลร้านในเครื่อง → ข้อความสั้นสำหรับแนบลิงก์ ('' = ไม่มีอะไรต้องย้าย)
export function packStorage(storage) {
  const data = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX)) data[key] = storage.getItem(key);
    }
  } catch { return ''; }
  return Object.keys(data).length ? encode(data) : '';
}

// เว็บใหม่: รับข้อมูล (ไม่ทับของที่มีอยู่แล้วในเว็บใหม่) · คืนจำนวนที่รับ
export function unpackStorage(storage, text) {
  let data;
  try { data = decode(text); } catch { return 0; }
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(PREFIX) || typeof value !== 'string' || value.length > 20000) continue;
    try {
      if (storage.getItem(key) === null) { storage.setItem(key, value); n++; }
    } catch { /* เครื่องลูกค้าไม่ให้เก็บ → ข้าม */ }
  }
  return n;
}

// คืน true = กำลังพาไปเว็บใหม่ (ไม่ต้องวาดหน้า)
export function moveDomain(loc = window.location, storage = window.localStorage, doc = document) {
  const params = new URLSearchParams(loc.search);
  if (loc.hostname === OLD_HOST && !params.has('privacy')) { // หน้านโยบายที่ยื่น Meta ไว้ ไม่ย้าย
    const packed = packStorage(storage);
    loc.replace(`https://${NEW_HOST}${loc.pathname}${loc.search}${packed ? `#${TAG}${packed}` : ''}`);
    return true;
  }
  if (loc.hash.startsWith(`#${TAG}`)) {
    // รับเฉพาะที่เด้งมาจากเว็บเดิมจริง (กันคนทำลิงก์ปลอมแอบใส่ออเดอร์/QR ของตัวเองให้ลูกค้า)
    if (String(doc.referrer || '').startsWith(`https://${OLD_HOST}/`)) {
      unpackStorage(storage, loc.hash.slice(1 + TAG.length));
    }
    try { window.history.replaceState(null, '', loc.pathname + loc.search); } catch { /* ข้ามได้ */ }
  }
  return false;
}
