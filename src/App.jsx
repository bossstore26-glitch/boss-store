import React, { useEffect, useRef, useState } from 'react';
import { ShoppingBag, CreditCard, ShieldCheck, ArrowRight, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
// ตารางเรทเดียวกับ server (server เป็นตัวตัดสินจริง หน้าเว็บใช้แสดงผล)
import { GAMES, GAME_KEYS, MAX_BAHT, chipsFor, rateNote, formatChips, minBaht, gameOf } from '../api/_rates.js';
import { t, LangSwitch, currentLang } from './i18n.jsx';

const POLL_MS = 3000;
const STORAGE_KEY = 'bossstore_pending_qr';

// ข้อความกลาง QR (QR ใช้ระดับแก้ผิด H ทนการบังได้ราว 30%)
// ใส่เกม + ไอดีที่ลูกค้ากรอก กันโกงสามเส้า: คนที่ได้รูป QR ต่อมาจะเห็นว่ากำลังจ่ายเติมเกมให้ไอดีไหน
// (ครอบตัดป้ายออก QR จะสแกนไม่ได้) ขนาดกล่อง/ตัวอักษรเท่าป้ายเดิมที่ทดสอบสแกนแล้ว
// เกมที่บอทค้นตัวละครให้ดูก่อนจ่ายได้ (12 พ.ย. เพิ่ม Siam หลังร้านล็อกอินบัญชี VIP ในจอรับเหรียญ)
const CHECK_ID_GAMES = ['royal', 'siam'];

// 18 พ.ย. ร้านสั่ง: กด "คัดลอก" แล้วเลื่อนลงไปข้อ 2 ให้เอง
function scrollStep(ref) {
  try {
    setTimeout(() => ref && ref.current && ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
  } catch { /* เพิกเฉย */ }
}

function qrLabel(game, gameId) {
  return [`เติม ${gameOf(game).name}`, `ID ${gameId}`, 'ร้าน BOSS STORE'];
}

// ข้อความแนะนำให้ลูกค้าวางใน {t('memoName')} ตอนโอน (ร้านสั่ง 14 พ.ย. · ไม่บังคับ บอทไม่ได้ตรวจ)
// เหยื่อโกงสามเส้าที่ต้องพิมพ์ "เติม Royal ..." จะสะดุดใจ + เป็นหลักฐานบนสลิป
function slipNote(game, gameId) {
  return `เติม ${gameOf(game).name.replace(/\s*Game$/i, '')} ไอดี ${gameId} เพจ BOSS STORE`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
}

// ธนาคารให้ลูกค้าเลือก (รหัสเดียวกับที่ Slip2Go ส่งมาในสลิป · len = จำนวนหลักเลขบัญชี · อื่นๆ = 10–15)
const BANKS = [
  { code: '004', name: 'กสิกร', len: 10 },
  { code: '014', name: 'ไทยพาณิชย์', len: 10 },
  { code: '006', name: 'กรุงไทย', len: 10 },
  { code: '002', name: 'กรุงเทพ', len: 10 },
  { code: '025', name: 'กรุงศรี', len: 10 },
  { code: '011', name: 'ttb', len: 10 },
  { code: '030', name: 'ออมสิน', len: 12 },
  { code: '034', name: 'ธ.ก.ส.', len: 12 },
  { code: 'other', name: 'อื่นๆ', len: 0 },
];

const MEMO_STEP = (<>ก่อนกดโอนเงิน จะมีช่อง <b>"บันทึก/บันทึกช่วยจำ"</b><br />ให้คัดลอกข้อความข้อ 1 วางก่อนโอนเงิน</>);

function SlipNote({ game, gameId, text, onCopied }) {
  const note = text || slipNote(game, gameId);
  const [copied, setCopied] = useState(false);
  return (
    <div className="bs-note">
      <span>{note}</span>
      <button type="button" className="bs-note-btn" onClick={async () => {
        await copyToClipboard(note);
        setCopied(true);
        if (onCopied) onCopied();
        setTimeout(() => setCopied(false), 2000);
      }}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}</button>
    </div>
  );
}

function loadPending() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (p && p.expiresAt && p.expiresAt * 1000 > Date.now()) return p;
  } catch {}
  return null;
}
// ร้านขอ 12 พ.ย.: จำไอดีเกมที่ลูกค้าเคยเติม (แยกตามเกม ล่าสุด 3 ไอดี) ไว้ในเครื่องลูกค้า · มีปุ่ม × ลบออกได้
const RECENT_KEY = 'bossstore_recent_ids';
const RECENT_MAX = 3;
function loadRecent() {
  try {
    const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
    return r && typeof r === 'object' ? r : {};
  } catch { return {}; }
}
function saveRecent(r) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* ข้ามได้ */ }
}
function savePending(p) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// แถบเตือนบน/ล่างของรูป QR กันโกงสามเส้า (โจรส่ง QR ให้เหยื่อโอนค่าสินค้าอื่น) · ร้านสั่ง 14 พ.ย.
const QR_WARN_TOP = ['ใช้บัญชีตัวเองเติมเหรียญเท่านั้น'];
const QR_WARN_BOTTOM = ['หากใช้บัญชีผู้อื่น เหรียญจะไม่ถูกส่ง'];

async function drawQr(canvas, data, label) {
  const size = 600;
  const lineH = 46;
  const topH = 24 + QR_WARN_TOP.length * lineH;
  const bottomH = 24 + QR_WARN_BOTTOM.length * lineH;
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, data, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });
  canvas.width = size;
  canvas.height = topH + size + bottomH;
  canvas.style.width = '';
  canvas.style.height = '';
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, size, canvas.height);
  ctx.drawImage(qr, 0, topH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';
  QR_WARN_TOP.forEach((t, i) => ctx.fillText(t, size / 2, 12 + lineH * (i + 0.5), size - 24));
  QR_WARN_BOTTOM.forEach((t, i) => ctx.fillText(t, size / 2, topH + size + 12 + lineH * (i + 0.5), size - 24));
  ctx.translate(0, topH); // ป้ายเกม/ไอดีกลาง QR วาดตามพิกัดเดิม
  // กล่องขาวตรงกลาง แล้ววางข้อความสีแดง
  // ขนาดนี้ทดสอบแล้วสแกนติดแม้ภาพเล็ก ถ้าขยายกล่อง/ตัวอักษร แอปธนาคารอาจสแกนไม่ติด
  const boxW = size * 0.5;
  const boxH = size * 0.17;
  const x = (size - boxW) / 2;
  const y = (size - boxH) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = '#dc2626';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 23px "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';
  const labelH = boxH / (label.length + 0.4);
  label.forEach((line, i) => {
    ctx.fillText(line, size / 2, y + labelH * (i + 0.7), boxW - 12);
  });
}

// บันทึก QR: คอม = ดาวน์โหลดไฟล์, มือถือ = เมนูแชร์ของเครื่อง (มี "บันทึกรูปภาพ")
// เบราว์เซอร์ในแอป (Messenger/Facebook/LINE) ไม่รองรับทั้งสองแบบ → โชว์รูปใหญ่ให้กดค้างบันทึก
async function saveQrImage(canvas, filename, showPreview) {
  const dataUrl = canvas.toDataURL('image/png');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
    return;
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // ลูกค้ากดปิดเมนูแชร์เอง
  }
  showPreview(dataUrl);
}

function QrPreview({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="บันทึกรูป QR"
      onClick={onClose}
    >
      <img src={src} alt="QR พร้อมเพย์ BOSS STORE" className="w-72 h-72 bg-white rounded-2xl p-2" onClick={(e) => e.stopPropagation()} />
      <p className="mt-4 text-white text-center font-bold">กดค้างที่รูป แล้วเลือก "บันทึกรูปภาพ"</p>
      <p className="mt-1 text-gray-300 text-xs text-center leading-relaxed">
        ถ้ากดค้างแล้วไม่มีเมนู ให้แคปหน้าจอแทน
        <br />หรือกด ⋯ มุมขวาบน แล้วเลือกเปิดใน Safari / Chrome
      </p>
      <button type="button" onClick={onClose} className="mt-5 text-white underline underline-offset-4">
        ปิด
      </button>
    </div>
  );
}

// รหัสรายการ 6 ตัว (ร้านใช้จับคู่กับข้อความ "รอตรวจ" ใน Telegram เวลาลูกค้าทักแชทเพจ)
// รายการเก่าแบบ Stripe (pi_...) ไม่มีรหัสนี้ → ไม่แสดง
// ร้านขอ 9 พ.ย.: ให้เห็นรหัสหลังจ่าย/อัปสลิปแล้วเท่านั้น (ทักเพจมาพร้อมรหัส = จ่ายแล้ว)
// fallbackAt = เวลา(ms)ที่จะโผล่ปุ่ม "โอนแล้วแต่ยังไม่ขึ้น?" กันกรณีระบบแจ้งเงินเข้าช้า/หลุด
function OrderCode({ id, visible, fallbackAt = 0, gameName = '', gameId = '', review = false }) {
  const [revealed, setRevealed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (visible || revealed || !fallbackAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [visible, revealed, fallbackAt]);
  if (!/^[A-Z0-9]{6}$/.test(String(id || ''))) return null;
  if (!visible && !revealed) {
    if (!fallbackAt || now < fallbackAt) return null;
    return (
      <button type="button" onClick={() => setRevealed(true)} className="bs-link muted" style={{ marginTop: 10, fontSize: 12 }}>
        โอนแล้วแต่ยังไม่ขึ้น? ดูรหัสรายการ
      </button>
    );
  }
  // ข้อความที่คัดลอก = บรรทัดบน ("เติม ... ให้ไอดี ...") + รหัสออเดอร์
  // ร้านสั่ง 18 พ.ย.: ตอนรอตรวจ (เติมครั้งแรก) คัดลอกเป็นประโยคพร้อมส่งในแชท LINE/Messenger
  const copyText = review
    ? `ยืนยันตัวตนเติมครั้งแรก ออเดอร์ #${id} ไอดี ${gameId}`
    : `เติม ${gameName} ให้ไอดี ${gameId} #${id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = copyText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <div className="bs-coderow">
        <span>รหัสออเดอร์ <b className="select-all">#{id}</b></span>
        <button type="button" onClick={copy} className="bs-copy">{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}</button>
      </div>
      <p className="bs-codenote">แจ้งรหัสนี้ที่เพจ BOSS STORE เมื่อเติมช้ากว่า 3 นาที</p>
    </>
  );
}

// กล่องบนสุดของหน้าจ่าย (ร้านขอ 12 พ.ย. ให้คงแบบเดิม): "เติม <เกม> ให้ไอดี <ไอดี>" + รหัสออเดอร์ + ปุ่มคัดลอก
// ร้านสั่ง 12 พ.ย. (รอบ 2): ซ่อนรหัสออเดอร์จนกว่าลูกค้าจะโอน/อัปสลิป (ยังไม่จ่ายไม่ต้องเห็นรหัส)
// ถ้าเลย fallbackAt แล้วยังไม่ขึ้น มีลิงก์ "โอนแล้วแต่ยังไม่ขึ้น? ดูรหัสรายการ" ให้กดเปิดเอง
function OrderBox({ pending, visible = true, fallbackAt = 0, review = false }) {
  return (
    <div className="bs-orderbox">
      <p className="t">เติม <b>{gameOf(pending.game).name}</b> ให้ไอดี <b className="id">{pending.gameId}</b></p>
      <OrderCode id={pending.id} gameName={gameOf(pending.game).name} gameId={pending.gameId}
        visible={visible} fallbackAt={fallbackAt} review={review} />
    </div>
  );
}

// ป๊อปอัปเมื่อบอทส่งเหรียญเข้าไอดีเสร็จจริง กด "ตกลง" กลับหน้าแรก
function DeliveredPopup({ pending, onOk, bonus = 0 }) {
  return (
    <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="delivered-title">
      <div className="bs-card" style={{ textAlign: 'center' }}>
        <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: 'var(--good)' }} />
        <h2 id="delivered-title" className="bs-h2" style={{ marginTop: 10 }}>ส่งเหรียญเสร็จแล้ว</h2>
        <p className="bs-gold" style={{ marginTop: 12, font: '800 26px/1.2 Prompt,sans-serif' }}>
          {formatChips(pending.chips, pending.game)} เหรียญ
        </p>
        {bonus > 0 && (
          // ร้านสั่ง 13 พ.ย.: โปรแถม — บอกลูกค้าหลังจ่ายว่าได้แถมเท่าไร (ยอดที่บอทส่งไปจริง)
          <p className="bs-promo-got">🎁 แถมโปรโมชั่น +{formatChips(bonus, pending.game)} เหรียญ</p>
        )}
        <p className="bs-sub" style={{ marginTop: 4 }}>
          เข้า {gameOf(pending.game).name} ไอดี <b className="bs-ink">{pending.gameId}</b> แล้ว
          <br />เข้าเกมตรวจกล่องของขวัญได้เลย ขอบคุณที่ใช้บริการ BOSS STORE
        </p>
        <button type="button" autoFocus onClick={onOk} className="bs-btn primary" style={{ marginTop: 18 }}>
          ตกลง
        </button>
      </div>
    </div>
  );
}

function PaymentCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('requires_action');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (canvasRef.current) drawQr(canvasRef.current, pending.qrData, qrLabel(pending.game, pending.gameId)).catch(console.error);
  }, [pending.qrData, pending.game, pending.gameId]);

  // ถามสถานะเป็นระยะ จนจ่ายสำเร็จ / ยกเลิก / หมดเวลา
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (pending.expiresAt * 1000 < Date.now()) {
        setStatus('expired');
        return;
      }
      try {
        const r = await fetch(`/api/payment-status?id=${encodeURIComponent(pending.id)}`);
        const d = await r.json();
        if (stopped) return;
        if (d.status === 'succeeded' || d.status === 'canceled') {
          setStatus(d.status);
          savePending(null);
          return;
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, POLL_MS);
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending.id, pending.expiresAt]);

  const saveQr = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `BOSS-STORE-QR-${pending.amount}บาท.png`;
    a.click();
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      const r = await fetch('/api/cancel-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pending.id }),
      });
      const d = await r.json();
      if (d.status === 'succeeded') {
        setStatus('succeeded');
        savePending(null);
        setCancelling(false);
        return;
      }
    } catch {}
    savePending(null);
    onCancel();
  };

  const paid = status === 'succeeded';
  const dead = status === 'canceled' || status === 'expired';

  return (
    <>
      <div className="bs-row" style={{ marginBottom: 12 }}>
        <h1 className="bs-h1" style={{ fontSize: 28 }}>สแกนจ่าย</h1>
      </div>
      <OrderBox pending={pending} visible={paid} />
      <div className="bs-qrbox">
        <div className="bs-muted" style={{ fontSize: 12.5 }}>ยอดชำระ</div>
        <div className="big">{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}<small>บาท</small></div>
        <div className="bs-gold" style={{ font: '700 14px/1.4 Prompt,sans-serif' }}>{formatChips(pending.chips, pending.game)} เหรียญ</div>
        <div className="bs-qr" style={{ opacity: dead ? 0.3 : 1 }}>
          <canvas ref={canvasRef} className="w-60 h-auto sm:w-64 block" />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {paid ? (
          <div className="bs-alert good">ชำระเงินสำเร็จ ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</div>
        ) : dead ? (
          <div className="bs-alert info">{status === 'expired' ? 'QR หมดอายุแล้ว' : 'ยกเลิกรายการแล้ว'} ยังไม่มีการเรียกเก็บเงิน</div>
        ) : (
          <p className="bs-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Loader2 className="w-5 h-5 bs-spin" /> รอการชำระเงิน... สแกนด้วยแอปธนาคาร
          </p>
        )}
      </div>
      <div className="bs-row" style={{ marginTop: 14, justifyContent: 'center', gap: 20 }}>
        {paid || dead ? (
          <button onClick={onDone} className="bs-link">{!paid ? t('newQr') : null}</button>
        ) : (
          <>
            <button onClick={saveQr} className="bs-link">บันทึก QR</button>
            <button onClick={cancel} disabled={cancelling} className="bs-link">
              {cancelling ? 'กำลังยกเลิก...' : 'ยกเลิก / แก้ไขยอด'}
            </button>
          </>
        )}
      </div>
      <p className="bs-cap" style={{ marginTop: 14 }}>ชำระเงินอย่างปลอดภัยผ่าน Stripe</p>
    </>
  );
}

// ย่อภาพสลิปก่อนส่ง (ยาวสุด 1600px JPEG) ให้อัปโหลดเร็วและไม่เกินขนาดที่ server รับ
// QR บนสลิปยังอ่านได้ชัด (สลิปจากแอปธนาคารปกติสูงไม่เกิน ~2000px)
async function slipToDataUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ปุ่มอัปโหลดสลิป: เด้ง + วงแสงกะพริบ (เริ่มทันทีที่เปิดหน้านี้) ปิดเองถ้าเครื่องตั้ง "ลดการเคลื่อนไหว"
const NUDGE_CSS = `
@keyframes upload-nudge-bounce { 0%, 100% { transform: translateY(0) } 12% { transform: translateY(-6px) } 24% { transform: translateY(0) } 34% { transform: translateY(-3px) } 44% { transform: translateY(0) } }
@keyframes upload-nudge-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(201, 74, 44, .55) } 50% { box-shadow: 0 0 0 10px rgba(201, 74, 44, 0) } }
.upload-nudge { animation: upload-nudge-bounce 2s ease-in-out infinite, upload-nudge-glow 1.4s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .upload-nudge { animation: upload-nudge-glow 2s ease-out infinite; } }
`;

// ---------- ดีไซน์ใหม่ 12 พ.ย. (ร้านส่งแบบมา: โทนครีม ตัวหนาใหญ่ การ์ดยอดเงินสีเข้ม ปุ่มส้มอิฐ) ----------
// สีทั้งหมดเป็นตัวแปร สลับมืด/สว่างด้วย class theme-dark ที่ <html> (ปุ่มพระจันทร์มุมขวาบน)
const STYLE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Prompt:wght@500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap');
:root{--bg:#ece7dd;--card:#fbf9f4;--card2:#f4f0e8;--line:#e3ddd1;--ink:#1c1813;--muted:#776e62;--soft:#a39a8d;
  --accent:#c94a2c;--accent-ink:#fff;--accent-hover:#b43f24;--good:#1f8a5b;--good-bg:#e8f4ec;--warn:#9a5b06;--warn-bg:#fbf1dc;
  --bad:#b4321f;--bad-bg:#fbebe6;--bad-line:#f0c7bb;--gold:#c48a1a;--dark:#1f1b16;--dark-ink:#f6f1e8;--chip:#efe9df;--chip-ink:#1c1813;
  --royal:#f0821f;--siam:#8b5cf6;--tmn:#e8771e;--shadow:0 1px 0 rgba(28,24,19,.04),0 10px 30px rgba(28,24,19,.08)}
html.theme-dark{--bg:#12100d;--card:#1c1915;--card2:#25211c;--line:#332e27;--ink:#f3eee6;--muted:#aaa194;--soft:#7f776b;
  --accent:#e0603e;--accent-hover:#ec7351;--good:#4cc68a;--good-bg:#173226;--warn:#f0b65a;--warn-bg:#33270f;
  --bad:#f08a72;--bad-bg:#3a1c15;--bad-line:#5c2d22;--gold:#e7b14a;--dark:#0d0b09;--dark-ink:#f6f1e8;--chip:#2c2722;--chip-ink:#f3eee6;
  --shadow:0 10px 30px rgba(0,0,0,.35)}
html,body{background:var(--bg)!important}
.bs-page{min-height:100vh;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;align-items:center;
  padding:20px 14px 40px;font-family:"IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif}
.bs-wrap{width:100%;max-width:440px}
.bs-card{background:var(--card);border:1px solid var(--line);border-radius:26px;box-shadow:var(--shadow);padding:22px 20px}
.bs-head{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:6px;margin-bottom:16px;flex-wrap:nowrap}
  .bs-brandrow{flex:0 0 auto;min-width:0}
  .bs-toolrow{flex:0 0 auto;justify-content:flex-end;flex-wrap:nowrap}
  .bs-brandrow{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
  .bs-toolrow{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;row-gap:6px}
.bs-logo{display:flex;align-items:center;gap:6px;font:800 16px/1 Prompt,sans-serif;letter-spacing:.2px;color:var(--ink);white-space:nowrap;flex:none}
  .bs-logo i{width:24px;height:24px;font-size:11.5px}
.bs-logo i{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);display:grid;place-items:center;font-style:normal;font-size:12px}
.bs-line{display:inline-flex;align-items:center;gap:2px;background:#06C755;color:#fff;border-radius:999px;padding:4px 8px 4px 6px;
  font:800 11.5px/1 Prompt,sans-serif;letter-spacing:.3px;text-decoration:none;white-space:nowrap;flex:none}
.bs-line span{font-size:13px;line-height:1}
.bs-line:hover{filter:brightness(1.07)}
.bs-pill{display:inline-flex;align-items:center;gap:6px;font:600 12px/1 Prompt,sans-serif;color:var(--ink);white-space:nowrap;flex:none}
.bs-dot{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 25%,transparent)}
.bs-lang-label{display:inline}
  @media (max-width:430px){
    .bs-head{gap:6px}
    .bs-logo{font-size:15px;gap:6px}
    .bs-logo i{width:22px;height:22px;font-size:11px}
    .bs-pill{font-size:10.5px;padding:3px 7px;gap:4px}
    .bs-lang-label{display:none}
    .bs-moon{width:30px;height:30px}
  }
  .bs-moon{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:var(--card2);color:var(--ink);
  display:grid;place-items:center;cursor:pointer;font-size:15px}
.bs-moon:focus,.bs-btn:focus,.bs-opt:focus,.bs-chipbtn:focus,.bs-method:focus,.bs-link:focus,.bs-copy:focus{outline:none}
.bs-moon:focus-visible,.bs-btn:focus-visible,.bs-opt:focus-visible,.bs-chipbtn:focus-visible,.bs-method:focus-visible,
.bs-link:focus-visible,.bs-copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:12px}
.bs-h1{font:800 clamp(27px,8vw,34px)/1.12 Prompt,sans-serif;color:var(--ink);letter-spacing:-.3px}
.bs-h2{font:800 24px/1.15 Prompt,sans-serif;color:var(--ink)}
.bs-titlerow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.bs-titlerow .bs-h1{flex:none;white-space:nowrap;font-size:clamp(24px,7.4vw,34px)}
.bs-scam{flex:1 1 auto;min-width:0;max-width:170px;display:flex;gap:5px;align-items:flex-start;background:var(--bad-bg);
  border:1px solid var(--bad-line);color:var(--bad);border-radius:14px;padding:8px 9px;margin-top:2px}
.bs-scam b{font:700 11.5px/1.45 Prompt,sans-serif}
@media (max-width:330px){.bs-titlerow{flex-direction:column}.bs-scam{max-width:none}}
.bs-sub{margin-top:8px;font-size:13.5px;color:var(--muted);line-height:1.55}
.bs-label{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px;font:600 14px/1.2 Prompt,sans-serif;color:var(--ink)}
.bs-label small{font:400 12px/1 "IBM Plex Sans Thai",sans-serif;color:var(--muted)}
.bs-opt{position:relative;text-align:left;border-radius:16px;border:1.5px solid var(--line);background:var(--card2);padding:12px 14px;
  color:var(--ink);cursor:pointer;transition:border-color .15s,background .15s}
.bs-opt[aria-checked="true"]{background:var(--card);border-color:var(--ink)}
.bs-opt:disabled{opacity:.5;cursor:not-allowed}
.bs-opt b{font:700 15px/1.2 Prompt,sans-serif;display:flex;align-items:center;gap:7px}
.bs-opt span.s{display:block;margin-top:3px;font-size:12px;color:var(--muted)}
.bs-tag{position:absolute;top:-9px;right:10px;background:var(--ink);color:var(--card);font:600 10.5px/1 Prompt,sans-serif;padding:4px 8px;border-radius:999px}
.bs-gdot{width:8px;height:8px;border-radius:50%;display:inline-block}
.bs-input{width:100%;background:var(--card);border:1.5px solid var(--line);border-radius:13px;padding:10px 14px;color:var(--ink);
  font:700 18px/1.2 Prompt,sans-serif;letter-spacing:.5px;outline:none;transition:border-color .15s}
.bs-input:focus{border-color:var(--ink)}
.bs-promo{display:flex;gap:10px;align-items:center;padding:11px 13px;border-radius:14px;
  background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 22%,transparent),color-mix(in srgb,var(--royal) 18%,transparent));
  border:1.5px solid color-mix(in srgb,var(--gold) 55%,transparent)}
.bs-promo .ic{font-size:26px;line-height:1}
.bs-promo b{display:block;font:700 15px/1.3 Prompt,sans-serif;color:var(--ink)}
.bs-promo span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.bs-promo-got{margin-top:8px;display:inline-block;padding:6px 12px;border-radius:999px;
  background:color-mix(in srgb,var(--gold) 20%,transparent);color:var(--gold);font:700 15px/1.3 Prompt,sans-serif}
.bs-recent{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
.bs-recent .lbl{font-size:12px;color:var(--muted);margin-right:2px}
.bs-recent .chip{display:inline-flex;align-items:center;background:var(--chip);color:var(--chip-ink);border-radius:999px;border:1.5px solid transparent}
.bs-recent .chip.on{border-color:var(--accent)}
.bs-recent .chip button{background:none;border:0;color:inherit;cursor:pointer}
.bs-recent .chip .id{font:600 13px/1 Prompt,sans-serif;padding:7px 4px 7px 11px;letter-spacing:.3px}
.bs-recent .chip .x{font:400 16px/1 sans-serif;padding:5px 9px 6px 5px;opacity:.6}
.bs-recent .chip .x:hover{opacity:1}
.bs-input::placeholder{color:var(--soft);font-weight:500;letter-spacing:0}
.bs-check{position:absolute;right:14px;top:50%;transform:translateY(-50%);font:600 12.5px/1 Prompt,sans-serif}
.bs-amount{background:var(--dark);color:var(--dark-ink);border-radius:18px;padding:12px 14px 11px}
html.theme-dark .bs-amount{border:1px solid var(--line)}
.bs-amount .top{display:flex;justify-content:space-between;font-size:12px;color:#b9b0a3}
.bs-amount input{width:100%;background:transparent;border:0;outline:none;color:var(--dark-ink);text-align:center;
  font:800 34px/1.1 Prompt,sans-serif;padding:4px 0 0;-moz-appearance:textfield}
.bs-amount input::-webkit-outer-spin-button,.bs-amount input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.bs-amount input::placeholder{color:#7d7468;font:600 20px/1.85 Prompt,sans-serif}
.bs-amount .unit{text-align:center;font-size:12px;color:#b9b0a3;margin-top:-2px}
.bs-amount .coins{margin-top:7px;padding-top:7px;border-top:1px dashed #4a433a;font:700 14px/1.3 Prompt,sans-serif;color:var(--gold)}
.bs-amount .note{font-size:11.5px;color:#9b9284;margin-top:2px}
.bs-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:9px}
.bs-chipbtn{background:var(--chip);color:var(--chip-ink);border:0;border-radius:10px;padding:8px 0;font:700 13px/1 Prompt,sans-serif;cursor:pointer}
.bs-chipbtn[aria-pressed="true"]{background:var(--accent);color:#fff}
.bs-link{background:none;border:0;color:var(--ink);text-decoration:underline;text-underline-offset:4px;font-size:13px;cursor:pointer}
.bs-link.muted{color:var(--muted)}
.bs-pkg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}
.bs-pkg button{display:flex;justify-content:space-between;align-items:center;background:var(--card2);border:1.5px solid var(--line);
  border-radius:12px;padding:9px 12px;font-size:13px;color:var(--ink);cursor:pointer}
.bs-pkg button[aria-pressed="true"]{border-color:var(--ink);background:var(--card)}
.bs-pkg b{font:700 13px/1 Prompt,sans-serif;color:var(--gold)}
.bs-methods{border-top:1px solid var(--line)}
.bs-method{width:100%;display:flex;align-items:center;gap:12px;padding:14px 2px;border:0;border-bottom:1px solid var(--line);
  background:none;color:var(--ink);text-align:left;cursor:pointer}
.bs-method:disabled{opacity:.5;cursor:not-allowed}
.bs-radio{width:20px;height:20px;border-radius:50%;border:2px solid var(--soft);flex:none;display:grid;place-items:center}
.bs-method[aria-checked="true"] .bs-radio{border-color:var(--radio,var(--accent))}
.bs-method[aria-checked="true"] .bs-radio::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--radio,var(--accent))}
.bs-method.pp{--radio:#6a5cf5}
html.theme-dark .bs-method.pp{--radio:#8f84ff}
.bs-btn.primary.pp{background:#6a5cf5;box-shadow:0 8px 20px rgba(106,92,245,.35)}
.bs-btn.primary.pp:hover{background:#5a4be6}
html.theme-dark .bs-btn.primary.pp{background:#7a6cff;box-shadow:0 8px 20px rgba(122,108,255,.3)}
html.theme-dark .bs-btn.primary.pp:hover{background:#8b7fff}
.bs-method b{font:700 15px/1.2 Prompt,sans-serif;display:block}
.bs-method span.s{font-size:12px;color:var(--muted)}
.bs-badge{margin-left:auto;font:600 11px/1 Prompt,sans-serif;padding:5px 9px;border-radius:999px;background:var(--bad-bg);color:var(--bad);border:1px solid var(--bad-line)}
.bs-alert{border-radius:16px;padding:12px 14px;font-size:13px;line-height:1.55}
.bs-alert.bad{background:var(--bad-bg);border:1px solid var(--bad-line);color:var(--bad)}
.bs-alert.warn{background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 30%,transparent);color:var(--warn)}
.bs-alert.good{background:var(--good-bg);border:1px solid color-mix(in srgb,var(--good) 30%,transparent);color:var(--good)}
.bs-alert.info{background:var(--card2);border:1px solid var(--line);color:var(--ink)}
.bs-alert b,.bs-alert strong{font-family:Prompt,sans-serif;font-weight:700}
.bs-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:18px;padding:16px 18px;
  font:700 17px/1.2 Prompt,sans-serif;cursor:pointer;transition:background .15s,transform .05s;text-decoration:none}
.bs-btn:active{transform:translateY(1px)}
.bs-btn.primary{background:var(--accent);color:var(--accent-ink);box-shadow:0 8px 20px color-mix(in srgb,var(--accent) 35%,transparent)}
.bs-btn.primary:hover{background:var(--accent-hover)}
.bs-btn.tmn{background:var(--tmn);color:#fff}
.bs-btn.ghost{background:var(--card2);color:var(--ink);border:1.5px solid var(--line);font-size:15px;padding:13px}
.bs-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.bs-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;margin-top:14px;font-size:12px;color:var(--muted)}
.bs-trust span::before{content:"✓ ";color:var(--good);font-weight:700}
.bs-cap{font-size:11.5px;color:var(--muted);text-align:center;letter-spacing:.2px;margin-bottom:6px}
.bs-qrbox{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:16px;text-align:left}
.bs-qrbox .big{font:800 42px/1 Prompt,sans-serif;color:var(--ink)}
.bs-qrbox .big small{font:600 15px/1 Prompt,sans-serif;color:var(--muted);margin-left:6px}
.bs-qr{background:#fff;border-radius:16px;padding:8px;margin:14px auto 0;width:fit-content;overflow:hidden}
.bs-banks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.bs-bank{border:1.5px solid var(--line);background:var(--card2);color:var(--ink);border-radius:12px;padding:9px 4px;
  font:700 13px/1.2 Prompt,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-bank.on{border-color:var(--ink);background:var(--ink);color:var(--card)}
.bs-qr-reveal{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:12px 12px;border:0;border-radius:14px;
  background:#fff;color:#1c1915;font:700 15px/1.45 Prompt,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:default;
  width:86%;box-sizing:border-box;
  border:2px solid #1c1915;pointer-events:none;user-select:none;text-align:center}
.bs-timer{text-align:center;font-size:13px;color:var(--muted);margin-top:8px}
.bs-timer b{font:800 16px/1 Prompt,sans-serif;color:var(--ink);margin:0 4px}
.bs-timer.low b{color:var(--bad)}
.bs-code{border:1.5px dashed var(--line);border-radius:18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.bs-code small{display:block;font-size:11.5px;color:var(--muted)}
.bs-code b{font:800 22px/1.2 Prompt,sans-serif;letter-spacing:1px;color:var(--ink)}
.bs-copy{background:var(--card);border:1.5px solid var(--ink);color:var(--ink);border-radius:12px;padding:7px 12px;font:700 12.5px/1 Prompt,sans-serif;cursor:pointer}
.bs-orderbox{background:var(--card2);border:1px solid var(--line);border-radius:20px;padding:14px 14px 12px;text-align:center;margin-bottom:12px}
.bs-orderbox .t{font:600 17px/1.4 Prompt,sans-serif;color:var(--ink)}
.bs-orderbox .t b{font-weight:800}
.bs-orderbox .t b.id{color:var(--gold)}
.bs-coderow{margin-top:10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;font:600 15px/1.3 Prompt,sans-serif;color:var(--ink)}
.bs-coderow b{font-weight:800;letter-spacing:1px;font-size:18px}
.bs-coderow .bs-copy{background:#f5b81c;border-color:#f5b81c;color:#1c1813;padding:8px 14px;font-size:13.5px}
.bs-codenote{margin-top:6px;font-size:12px;color:var(--muted)}
.bs-steps{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.bs-steps li{display:flex;gap:12px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:var(--ink)}
@keyframes bsMemoPop{0%{opacity:0;transform:translateY(6px) scale(.92)}60%{opacity:1;transform:translateY(-1px) scale(1.03)}100%{opacity:1;transform:none}}
.bs-memo-pop{display:inline-block;animation:bsMemoPop .45s ease-out .35s both}
.bs-memo-why{margin-top:10px;display:grid;gap:6px;font-size:13.5px;line-height:1.4;color:var(--ink)}
.bs-memo-why .row{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.bs-memo-why .row.good{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.45)}
.bs-memo-why b{color:var(--good,#22c55e)}
.bs-memo-hint{display:block;margin-top:6px;color:#f5b81c;font-weight:800;line-height:1.5}
.bs-memo-hint b{color:#f5b81c;text-decoration:underline;text-underline-offset:3px}
.bs-steps li i{flex:none;width:22px;height:22px;border-radius:50%;background:var(--ink);color:var(--card);font:700 12px/22px Prompt,sans-serif;text-align:center;font-style:normal}
.bs-verify{margin-top:14px;padding:14px;border-radius:16px;background:var(--card);border:1.5px solid var(--line);color:var(--ink)}
.bs-note{display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 8px 8px 12px;border:1.5px dashed var(--line);border-radius:12px;background:var(--card)}
.bs-note span{flex:1;min-width:0;font-weight:700;font-size:13px;line-height:1.4;word-break:break-word}
.bs-note-btn{flex:none;padding:7px 14px;border-radius:999px;background:#f5b81c;color:#1c1813;font:700 13px/1.2 Prompt,sans-serif;cursor:pointer;border:0;animation:bs-copy-pulse 1.6s ease-out infinite}
@keyframes bs-copy-pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,184,28,.55)}50%{box-shadow:0 0 0 8px rgba(245,184,28,0)}}
@media (prefers-reduced-motion: reduce){.bs-note-btn{animation:none}}
.bs-row{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12.5px;color:var(--muted)}
.bs-modal{position:fixed;inset:0;z-index:50;background:rgba(20,17,13,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.bs-modal .bs-card{width:100%;max-width:400px;max-height:92vh;overflow:auto}
.bs-idbig{font:800 32px/1.1 Prompt,sans-serif;letter-spacing:1px;color:var(--ink)}
.bs-otp{flex:1;min-width:0;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--ink);
  font:700 20px/1 Prompt,sans-serif;letter-spacing:6px;outline:none}
.bs-otp:focus{border-color:var(--ink)}
.bs-muted{color:var(--muted)}
.bs-gold{color:var(--gold)}
.bs-ink{color:var(--ink)}
.bs-spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;

// ปุ่มพระจันทร์ มุมขวาบน: สลับโหมดมืด/สว่าง (จำค่าไว้ในเครื่อง · เริ่มต้นโหมดสว่างแบบดีไซน์ใหม่)
function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button type="button" onClick={onToggle} className="bs-moon" aria-label={dark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}>
      <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
    </button>
  );
}

const LINE_OA_URL = 'https://line.me/R/ti/p/@019hqour'; // LINE OA ของร้าน (เพิ่มเพื่อน)
const MESSENGER_URL = 'https://m.me/100079341141775'; // แชทเพจ Facebook BOSS STORE

// หัวการ์ด: โลโก้ BOSS STORE + ปุ่ม LINE + ไฟเขียว 24 ชม. + ปุ่มธีม (ทุกหน้าใช้เหมือนกัน)
function Header({ theme, onToggle, right }) {
  return (
    <div className="bs-head">
      <div className="bs-brandrow">
        <div className="bs-logo"><i aria-hidden="true">B</i>BOSS STORE</div>
      </div>
      <div className="bs-toolrow">
        <a className="bs-line" href={LINE_OA_URL} target="_blank" rel="noopener noreferrer" aria-label="เพิ่มเพื่อน LINE BOSS STORE">
          <span aria-hidden="true">+</span>LINE
        </a>
        {right}
        <LangSwitch />
        {onToggle && <ThemeToggle theme={theme} onToggle={onToggle} />}
      </div>
    </div>
  );
}

// ร้านกด "📎 ขอสลิปยืนยัน 0.10 บาท" ใน Telegram (ร้านสั่ง 14 พ.ย.) → QR 0.10 + บันทึกช่วยจำ + ปุ่มอัปสลิป
// บอทตรวจ: สลิปต้นฉบับ (Slip2Go) + คนโอนคนเดียวกับสลิปแรก แล้วแจ้งร้าน ร้านดูบันทึกช่วยจำแล้วกดส่งเอง
function VerifyBox({ pending, verify, onState }) {
  const canvasRef = useRef(null);
  const verifyStep2Ref = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const canUpload = !busy && (verify.state === 'open' || verify.state === 'bad') && verify.triesLeft > 0;
  useEffect(() => {
    if (canvasRef.current && verify.qrData) {
      drawQr(canvasRef.current, verify.qrData, qrLabel(pending.game, pending.gameId)).catch(console.error);
    }
  }, [verify.qrData, pending.game, pending.gameId, verify.state === 'ok']);
  const send = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await slipToDataUrl(file);
      const r = await fetch('/api/promptpay-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pending.id, image, verify: true, bank: pending.bank || '', lang: currentLang() }),
      });
      const d = await r.json();
      onState({ ...verify, state: d.status === 'ok' ? 'ok' : 'bad', message: d.message || '' });
    } catch {
      onState({ ...verify, state: 'bad', message: 'เชื่อมต่อร้านไม่ได้ชั่วคราว ลองอัปใหม่อีกครั้ง' });
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  if (verify.state === 'ok') {
    return (
      <div className="bs-alert good" style={{ marginTop: 12 }}>
        {verify.message || 'ได้รับสลิปยืนยันแล้ว ✅ ร้านกำลังตรวจ แล้วส่งเหรียญให้'}
      </div>
    );
  }
  return (
    <div className="bs-verify">
      <b>ร้านขอสลิปยืนยันตัวตนเพิ่ม</b>
      <ol className="bs-steps" style={{ marginTop: 8 }}>
        <li><i>1</i><span style={{ flex: 1, minWidth: 0 }}>คัดลอกข้อความนี้
          <SlipNote game={pending.game} gameId={pending.gameId} onCopied={() => scrollStep(verifyStep2Ref)} /></span></li>
        <li ref={verifyStep2Ref}><i>2</i><span>สแกน QR โอน <b>{Number(verify.amount).toFixed(2)} บาท</b><br />จาก<b>บัญชีเดียวกับที่จ่ายครั้งแรก</b></span></li>
        <li><i>3</i><span style={{ flex: 1, minWidth: 0 }}>{MEMO_STEP}<div style={{ width: '100%', marginTop: 6 }}><MemoExample fit amount={pending.amount} selectedGame={pending.game} playerId={pending.gameId} /></div></span></li>
        <li><i>4</i><span>อัปรูปสลิปจากแอปธนาคาร (ห้ามถ่ายจากจอ)</span></li>
      </ol>
      <div className="bs-qr" style={{ marginTop: 10 }}>
        <canvas ref={canvasRef} className="w-56 h-auto block" />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      <button type="button" className="bs-btn primary" style={{ marginTop: 12 }} disabled={!canUpload}
        onClick={() => fileRef.current?.click()}>
        {busy || verify.state === 'checking'
          ? (<><Loader2 className="w-5 h-5 bs-spin" /> กำลังตรวจสลิป...</>)
          : `อัปโหลดสลิป ${Number(verify.amount).toFixed(2)} บาท`}
      </button>
      {verify.state === 'bad' && verify.message && (
        <div className="bs-alert bad" style={{ marginTop: 10, textAlign: 'center' }}>
          {verify.message}{verify.triesLeft > 0 ? ` (อัปได้อีก ${verify.triesLeft} ครั้ง)` : ''}
        </div>
      )}
    </div>
  );
}

// พร้อมเพย์ธนาคารร้าน: สแกนจ่าย → อัปโหลดสลิป → บอทตรวจสลิปกับธนาคาร (Slip2Go) แล้วส่งเหรียญ

// 18 พ.ย.: ตัวอย่างแอนิเมชันวิธีวางข้อความในช่อง "บันทึกช่วยจำ" ของแอปธนาคาร
function MemoExample({ amount = 20, selectedGame = 'royal', playerId = '4873176', fit = false }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((p) => (p + 1) % 3), 1800);
    return () => clearInterval(timer);
  }, []);

  const memoText = `เติม ${selectedGame === 'siam' ? 'Siam' : 'Royal'} ไอดี ${playerId || '4873176'} เพจ BOSS STORE`;

  return (
    <div className="my-2 flex w-full flex-col items-center select-none">
      <div className="mb-2 text-[12.5px] font-bold text-zinc-300">📱 ตัวอย่างหน้าจอตอนโอนในแอปธนาคาร</div>
      <div className={`relative ${fit ? 'w-full max-w-[285px]' : 'w-[285px]'} shrink-0 rounded-[36px] border-[4px] border-zinc-500 bg-zinc-900 p-2 shadow-2xl`}>
        {/* 20 พ.ย. ร้านสั่ง: จอในมือถือเป็นโหมดสว่างแบบแอปธนาคารจริง (โหมดมืดกลืนกับเว็บ ลูกค้าดูไม่ออก) */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#FFFFFF] pb-3">
          <div className="px-3 pt-2 pb-2 border-b border-zinc-200">
            <div className="mx-auto mb-2 h-4 w-24 rounded-full bg-black" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500">‹</span>
              <span className="text-xs font-bold text-zinc-900">ยืนยันการโอนเงิน</span>
              <span className="rounded bg-[#113566] px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-wide text-white">PromptPay</span>
            </div>
          </div>

          <div className="px-3 pt-2.5">
          <div className="mb-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-[11px]">
            <div className="mb-2 text-center">
              <div className="text-[10px] text-zinc-500">จำนวนเงิน</div>
              <div className="text-xl font-extrabold text-zinc-900">{Number(amount || 20).toFixed(2)} <span className="text-xs font-semibold">บาท</span></div>
            </div>
            <div className="space-y-1.5 border-t border-zinc-200 pt-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">ไปยัง</span>
                <span className="font-bold text-zinc-900">บอส สโตร์</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">พร้อมเพย์</span>
                <span className="text-zinc-700">XXX-XXX-1209</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ค่าธรรมเนียม</span>
                <span className="text-zinc-700">0.00 บาท</span>
              </div>
            </div>
          </div>

          <div className="relative my-2">
            <div
              className={`rounded-xl border-2 bg-white p-2.5 transition-all duration-300 ${
                step === 2
                  ? 'border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.35)]'
                  : 'border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-700">บันทึกช่วยจำ (Memo)</span>
                {step === 2 && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                    ✓ วางเรียบร้อย
                  </span>
                )}
              </div>

              <div
                className={`absolute top-[26px] right-4 z-20 transition-all duration-200 ${
                  step === 1 ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
                }`}
              >
                <div className="relative rounded-md bg-zinc-800 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-lg">
                  วาง (Paste)
                  <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-zinc-800" />
                </div>
              </div>

              <div className={`relative h-[48px] shrink-0 rounded-lg border px-2.5 py-1.5 text-xs leading-tight flex items-center overflow-hidden transition-colors duration-300 ${
                step === 2 ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-300 bg-zinc-50'}`}>
                {step === 0 && (
                  <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                    <span className="inline-block h-3.5 w-0.5 bg-zinc-400 animate-pulse" />
                    <span>แตะช่องนี้</span>
                    <span className="inline-block animate-bounce text-base">👆</span>
                  </span>
                )}
                {step >= 1 && (
                  // จังหวะ 2: กด "วาง" แล้วข้อความจริงของออเดอร์เด้งเข้าช่อง · จังหวะ 3: ค้างไว้ + กรอบเขียว
                  <span key={step === 1 ? 'pop' : 'stay'}
                    className={`font-semibold text-[11px] leading-tight text-zinc-900 ${step === 1 ? 'bs-memo-pop' : ''}`}>{memoText}</span>
                )}
              </div>
            </div>

            <div
              className={`absolute right-2 -bottom-3 z-20 flex items-center transition-transform duration-300 ${
                step === 2 ? 'scale-95' : 'scale-100 animate-pulse'
              }`}
            >
              <div className="h-0 w-0 border-y-[12px] border-y-transparent border-r-[14px] border-r-yellow-400 drop-shadow" />
              <div className="rounded-lg bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 px-2.5 py-1 text-[11px] font-extrabold leading-tight text-zinc-950 shadow-lg border border-yellow-300/60">
                {step === 2 ? 'เรียบร้อย!' : (<>วางข้อความ<br />ตรงนี้!</>)}
              </div>
            </div>
          </div>

          <div
            className={`mt-4 rounded-lg py-2 text-center text-xs font-bold transition-colors duration-300 ${
              step === 2 ? 'bg-[#1f7a5c] text-white shadow-md' : 'bg-zinc-300 text-zinc-500'
            }`}
          >
            ยืนยัน
          </div>

          <div className="mx-auto mt-2.5 h-1 w-24 rounded-full bg-zinc-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BankPromptPayCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  // idle = รอโอน/อัปโหลด, checking = กำลังตรวจ, paid, review = ร้านตรวจไอดีใหม่, locked
  const [status, setStatus] = useState('idle');
  const [bonus, setBonus] = useState(0);
  const [verify, setVerify] = useState(null);
  // กดคัดลอกบันทึกแล้ว → ค่อยโชว์ QR (เบลอไว้ก่อน ร้านสั่ง 18 พ.ย.) + ปุ่มบันทึกภาพ QR · จำต่อออเดอร์ (รีเฟรชไม่ต้องกดใหม่)
  const copiedKey = `bossstore_copied_${pending.id}`;
  const [noteCopied, setNoteCopiedRaw] = useState(() => {
    try { return localStorage.getItem(copiedKey) === '1'; } catch { return false; }
  });
  const setNoteCopied = (v) => {
    setNoteCopiedRaw(v);
    try { if (v) localStorage.setItem(copiedKey, '1'); } catch { /* ข้ามได้ */ }
  };
  const copyAndReveal = async () => {
    await copyToClipboard(slipNote(pending.game, pending.gameId));
    setNoteCopied(true);
  };
  const [msg, setMsg] = useState('');
  const [msgBad, setMsgBad] = useState(false);
  // QR ใช้ได้ 10 นาที (กันเซฟ QR ไว้ให้คนอื่นจ่ายทีหลัง) หมดแล้วยังอัปโหลดสลิปได้ถ้าโอนไปแล้ว
  const qrDeadline = (pending.qrExpiresAt || pending.expiresAt) * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // ร้านสั่ง 18 พ.ย.: ธนาคารยังไม่พบรายการ/ระบบตรวจล่ม → พักปุ่มอัปสลิป 45 วิ (จำในเครื่อง รีเฟรชไม่รีเซ็ต)
  const coolKey = `bossstore_cool_${pending.id}`;
  const [coolUntil, setCoolUntilRaw] = useState(() => {
    try { return Number(localStorage.getItem(coolKey)) || 0; } catch { return 0; }
  });
  const startCooldown = (sec) => {
    const s = Number(sec) || 0;
    if (s <= 0) return;
    const until = Date.now() + s * 1000;
    setCoolUntilRaw(until);
    try { localStorage.setItem(coolKey, String(until)); } catch { /* ข้ามได้ */ }
  };
  const coolLeft = Math.max(0, Math.ceil((coolUntil - now) / 1000));
  const secondsLeft = Math.max(0, Math.ceil((qrDeadline - now) / 1000));
  const qrExpired = secondsLeft === 0;
  // เอฟเฟกต์ปุ่มอัปโหลดเด้ง/กะพริบตั้งแต่เปิดหน้านี้เลย (ลูกค้าบางคนโอนแล้วไม่รู้ว่าต้องอัปโหลดสลิป)
  const qrCreatedMs = pending.qrExpiresAt ? (pending.qrExpiresAt - 10 * 60) * 1000 : 0;
  const nudgeUpload = qrCreatedMs > 0;

  // ลูกค้าสลับไปแอปธนาคารแล้วกลับมา (หน้าเว็บถูกซ่อน ≥ 5 วิ) → ป๊อปอัปกลางจอพร้อมปุ่มเลือกสลิป
  const [returnPrompt, setReturnPrompt] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= 5000 && statusRef.current === 'idle') setReturnPrompt(true);
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!qrExpired && canvasRef.current) drawQr(canvasRef.current, pending.qrData, qrLabel(pending.game, pending.gameId)).catch(console.error);
  }, [pending.qrData, pending.game, pending.gameId, qrExpired]);

  // อัปโหลดแล้วอยู่ระหว่างร้านตรวจ (หรือกลับมาเปิดหน้าใหม่) → ถามสถานะจนส่งเหรียญ
  useEffect(() => {
    let stopped = false;
    let timer;
    const tick = async () => {
      try {
        const r = await fetch(`/api/truemoney-status?code=${encodeURIComponent(pending.id)}`);
        const d = await r.json();
        if (stopped) return;
        // 19 พ.ย. ร้านสั่ง: ร้านกดไม่ส่ง/โอนเงินคืนแล้ว → แจ้งแล้วกลับหน้าแรก
        if (d.status === 'cancelled') { alert(d.message || 'รายการนี้ถูกยกเลิก'); onDone(); return; }
        if (d.status === 'delivered') {
          setBonus(Number(d.bonus) || 0);
          setStatus('delivered');
          savePending(null);
          return;
        }
        if (d.status === 'paid') setStatus('paid'); // ถามต่อจนบอทส่งเหรียญเสร็จ
        if (d.status === 'review') setStatus((s) => (s === 'checking' ? s : 'review'));
        setVerify(d.status === 'review' && d.verify ? d.verify : null); // ร้านกด 📎 ขอสลิปยืนยัน 0.10 บาท
        // บอทกำลังรอธนาคารยืนยันสลิป (ตรวจซ้ำเองทุกไม่กี่นาที)
        if (d.status === 'checking') setStatus((s) => (s === 'checking' ? s : 'bankwait'));
        // บอทตรวจซ้ำเองแล้วไม่ผ่าน / ร้านกด "ขอสลิปใหม่" (ร้านสั่ง 12 พ.ย.) → กลับไปหน้าอัปโหลด
        if (d.status === 'failed') {
          setStatus((s) => (s === 'bankwait' || s === 'review' ? 'idle' : s));
          setMsg(d.message || 'ตรวจสลิปไม่ผ่าน กรุณาทักแชทเพจ BOSS STORE พร้อมสลิป');
          setMsgBad(true);
          if (d.cooldown) startCooldown(d.cooldown);
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, 4000);
    };
    timer = setTimeout(tick, 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending.id]);

  const upload = async (file) => {
    if (!file) return;
    setStatus('checking');
    setMsg('');
    try {
      const image = await slipToDataUrl(file);
      const r = await fetch('/api/promptpay-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pending.id, image, bank: pending.bank || '', lang: currentLang() }),
      });
      const d = await r.json();
      setMsg(d.message || '');
      if (d.cooldown) startCooldown(d.cooldown);
      if (d.status === 'paid') {
        setStatus('paid');
        setMsgBad(false);
      } else if (d.status === 'review') {
        setStatus('review');
        setMsgBad(false);
      } else if (d.status === 'waiting') {
        setStatus('bankwait');
        setMsgBad(false);
      } else {
        setStatus(d.status === 'locked' ? 'locked' : 'idle');
        setMsgBad(true);
      }
    } catch {
      // อาจส่งถึงร้านแล้วแต่รอผลนานเกิน → หน้านี้ถามสถานะต่อเอง (เปลี่ยนเป็นรอธนาคาร/สำเร็จได้)
      setStatus('idle');
      setMsgBad(true);
      setMsg('ยังไม่ได้รับผลตรวจ รอสักครู่ หน้านี้จะอัปเดตเอง ถ้าผ่านไป 1 นาทีแล้วไม่เปลี่ยน ให้อัปโหลดสลิปใหม่');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const [preview, setPreview] = useState(null);
  const step2Ref = useRef(null);
  const saveQr = () =>
    saveQrImage(canvasRef.current, `BOSS-STORE-QR-${pending.amount}baht.png`, setPreview).catch(() =>
      setPreview(canvasRef.current.toDataURL('image/png')),
    );

  const cancel = () => {
    if (!window.confirm('ถ้าโอนเงินไปแล้ว ห้ามยกเลิก ให้กด "อัปโหลดสลิป" แทน\n\nยังไม่ได้โอน และต้องการยกเลิกรายการนี้?')) return;
    savePending(null);
    onCancel();
  };

  const paid = status === 'paid' || status === 'delivered';
  const bankwait = status === 'bankwait';
  const review = status === 'review' || bankwait; // ซ่อน QR/ปุ่มอัปโหลดเหมือนกัน
  const checking = status === 'checking';
  const locked = status === 'locked';

  const money = pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return (
    <>
      <style>{NUDGE_CSS}</style>
      {returnPrompt && status === 'idle' && (
        <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="return-title">
          <div className="bs-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }} aria-hidden="true">📎</div>
            <h2 id="return-title" className="bs-h2" style={{ marginTop: 6 }}>โอนเสร็จแล้วใช่ไหม?</h2>
            <p className="bs-sub">
              อัปโหลดสลิปเพื่อรับ <b className="bs-gold">{formatChips(pending.chips, pending.game)} เหรียญ</b>
              <br />เข้าไอดี <b className="bs-ink">{pending.gameId}</b>
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => { setReturnPrompt(false); fileRef.current?.click(); }}
              className="bs-btn primary upload-nudge"
              style={{ marginTop: 18 }}
            >
              📎 เลือกสลิปจากแอปธนาคาร
            </button>
            <button type="button" onClick={() => setReturnPrompt(false)} className="bs-link muted" style={{ marginTop: 12 }}>
              ยังไม่ได้โอน
            </button>
          </div>
        </div>
      )}
      <QrPreview src={preview} onClose={() => setPreview(null)} />
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} bonus={bonus} />}

      <div className="bs-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <h1 className="bs-h1" style={{ fontSize: 28 }}>
          {paid ? 'กำลังส่งเหรียญ' : review ? 'รอตรวจสอบ' : 'สแกนจ่าย'}
        </h1>
      </div>
      <OrderBox pending={pending} visible={status !== 'idle' || !!msg} review={review && !bankwait}
        fallbackAt={pending.qrExpiresAt ? (pending.qrExpiresAt - 10 * 60 + 3 * 60) * 1000 : 0} />

      <div className="bs-qrbox">
        <div className="bs-muted" style={{ fontSize: 12.5 }}>{t('payAmount')} ({t('mustMatch')})</div>
        <div className="big">{money}<small>{t('bahtUnit')}</small></div>
        <div className="bs-gold" style={{ font: '700 14px/1.4 Prompt,sans-serif' }}>{formatChips(pending.chips, pending.game)} เหรียญ</div>
        {!paid && !review && !qrExpired && (
          <>
            <div className="bs-qr" style={{ position: 'relative' }}>
              <canvas ref={canvasRef} className="w-60 h-auto sm:w-64 block"
                style={noteCopied ? undefined : { filter: 'blur(9px)', pointerEvents: 'none', userSelect: 'none' }}
                aria-hidden={!noteCopied} />
              {!noteCopied && (
                // ร้านสั่ง 18 พ.ย.: เป็นแค่ป้าย กดไม่ได้ (ลูกค้าต้องกดคัดลอกที่ข้อ 1 เอง)
                <div className="bs-qr-reveal" aria-hidden="true">
                  กดปุ่ม 'คัดลอก'<br />สีเหลืองด้านล่าง<br />เพื่อปลดล็อก QR
                </div>
              )}
            </div>
            <p className={`bs-timer ${secondsLeft <= 60 ? 'low' : ''}`}>
              เหลือ<b>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</b>{t('qrExpiresIn')}
            </p>
            {noteCopied && (
              <button type="button" onClick={saveQr} className="bs-btn" style={{ marginTop: 6, width: '100%' }}>📥 {t('saveQr')}</button>
            )}
          </>
        )}
        {!paid && !review && qrExpired && (
          <div className="bs-alert bad" style={{ marginTop: 12, textAlign: 'center' }}>
            <b>{t('qrExpiredTitle')}</b>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t('qrExpiredHint')}</div>
            <button type="button" onClick={() => { savePending(null); onCancel(); }} className="bs-btn ghost" style={{ marginTop: 10 }}>
              สร้าง QR ใหม่
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {paid ? (
          <div className="bs-alert good" style={{ display: 'flex', gap: 8 }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{t('sendingCoins')}</span>
          </div>
        ) : review && !bankwait ? (
          // ร้านสั่ง 14 พ.ย.: ถูกกักตรวจ (ไอดีใหม่/ชื่อไม่ตรง) → ให้ทักเพจส่งสลิปที่มีบันทึกช่วยจำ ยืนยันว่าโอนเองจริง
          <div className="bs-alert warn">
            <b>✅ {t('firstVerify')}</b>
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>
              {t('chatShop')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <a className="bs-btn" style={{ flex: 1, background: '#06C755', color: '#fff' }} href={LINE_OA_URL} target="_blank" rel="noopener noreferrer">LINE</a>
              <a className="bs-btn" style={{ flex: 1, background: '#0084FF', color: '#fff' }} href={MESSENGER_URL} target="_blank" rel="noopener noreferrer">Messenger</a>
            </div>
            <div className="bs-cap" style={{ marginTop: 8 }}>{t('noReupload')}</div>
            {verify && <VerifyBox pending={pending} verify={verify} onState={setVerify} />}
          </div>
        ) : review ? (
          <div className="bs-alert warn" style={{ display: 'flex', gap: 8 }}>
            <Loader2 className="w-5 h-5 shrink-0 bs-spin" />
            <span>
              {bankwait
                ? `${t('waitBank')}`
                : msg && !msgBad
                  ? msg
                  : `✅ ${t('paidReview')}`}
              <br />{t('noReupload')}
            </span>
          </div>
        ) : (
          <>
            <ol className="bs-steps">
              {!qrExpired && (
                <li><i>1</i><span style={{ flex: 1, minWidth: 0 }}>{t('step1a')}
                  <br /><b style={{ color: 'var(--red, #dc2626)' }}>{t('step1b')}</b>
                  <SlipNote game={pending.game} gameId={pending.gameId} onCopied={() => { setNoteCopied(true); scrollStep(step2Ref); }} />
                  {/* 20 พ.ย. ร้านสั่ง: บอทอ่านบันทึกจากสลิปเอง ไอดีใหม่ใส่ถูก = ส่งเลย ไม่ต้องรอร้าน → บอกลูกค้าให้อยากใส่ */}
                  <div className="bs-memo-why">
                    <div className="row good"><span>✅</span><span>ใส่บันทึก → <b>ได้เหรียญทันที</b></span></div>
                    <div className="row"><span>⏳</span><span>ไม่ใส่บันทึก → รอร้านตรวจ</span></div>
                  </div></span></li>
              )}
              <li ref={step2Ref}><i>{qrExpired ? 1 : 2}</i><span>{t('step2')} (<b>{money} บาท</b>)<br />
                <span className="bs-memo-hint">{t('memoHint')} <b>"บันทึกช่วยจำ"</b></span>
            <MemoExample amount={pending.amount} selectedGame={pending.game} playerId={pending.gameId} /></span></li>
              <li><i>{qrExpired ? 2 : 3}</i><span>{t('step3')}<br />เพื่อ<b style={{ color: 'var(--good, #22c55e)' }}>{t('step3b')}</b></span></li>
            </ol>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            {/* ร้านสั่ง 18 พ.ย.: ซ่อนปุ่มอัปสลิปจนกดคัดลอกข้อความ (QR หมดอายุ/เคยอัปแล้วมีข้อความผล = โชว์เสมอ เผื่อโอนไปแล้ว) */}
            {noteCopied || qrExpired || checking || locked || msg ? (<>
              {/* ร้านสั่ง 18 พ.ย.: ลด 400001 (ลูกค้าถ่ายรูปจอ/ครอปสลิป อ่าน QR ไม่ได้) */}
              <div className="bs-alert bad" style={{ marginTop: 18, textAlign: 'center', fontWeight: 700 }}>{t('uploadShot')}</div>
              <button
                type="button"
                disabled={checking || locked || coolLeft > 0}
                onClick={() => fileRef.current?.click()}
                className={`bs-btn primary ${nudgeUpload && !checking && !locked && !coolLeft ? 'upload-nudge' : ''}`}
                style={{ marginTop: 10 }}
              >
                {checking ? (<><Loader2 className="w-5 h-5 bs-spin" /> {t('checkingSlip')}</>)
                  : coolLeft > 0 ? `⏳ ${t('uploadCool')} 0:${String(coolLeft).padStart(2, '0')}`
                  : t('upload')}
              </button>
            </>) : (
              <button type="button" onClick={copyAndReveal} className="bs-btn ghost" style={{ marginTop: 18 }}>
                {/* 20 พ.ย. ร้านสั่ง: ตัดบรรทัดตรงวรรค ไม่ให้คำขาดกลาง */}
                📋 กดคัดลอกข้อความข้อ 1 ก่อน<br />แล้วปุ่มอัปโหลดสลิปจะขึ้น
              </button>
            )}
            {msg && (
              <div className={`bs-alert ${msgBad ? 'bad' : 'good'}`} style={{ marginTop: 10, textAlign: 'center' }}>{msg}</div>
            )}
            <p className="bs-cap" style={{ marginTop: 10, lineHeight: 1.6 }}>
              {t('uploadHint')}
              <br />{t('uploadHint2')}
            </p>
          </>
        )}
      </div>

      <div className="bs-row" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {paid || review ? (
          <>
            {/* 20 พ.ย. ร้านสั่ง: เอาปุ่มกลับหน้าแรกออก (ลูกค้ากดแล้วหลุดจากออเดอร์ที่รอตรวจ) */}
            <span>ติดปัญหาเรื่องเหรียญ แจ้งเพจพร้อมรหัสด้านบน</span>
          </>
        ) : (
          <>
            <button onClick={cancel} className="bs-link muted">{t('cancelEdit')}</button>
          </>
        )}
      </div>
    </>
  );
}

// ทรูมันนี่: กดเปิดแอป (มือถือ) หรือสแกน QR ลิงก์ (คอม) ยอดและข้อความถูกกรอกให้แล้ว
function TrueMoneyCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('waiting');
  const [bonus, setBonus] = useState(0);
  // ไอดีใหม่: ร้านส่ง OTP ไปที่เบอร์ทรูมันนี่ที่โอน ลูกค้ากรอกแล้วได้เหรียญทันที
  const [otpInfo, setOtpInfo] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

  const otpCall = async (action) => {
    setOtpBusy(true);
    try {
      const r = await fetch('/api/truemoney-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pending.id, action, otp }),
      });
      const d = await r.json();
      setOtpMsg(d.message || '');
      if (d.status === 'ok' && action === 'verify') setStatus('paid');
      if (action === 'resend' && d.status === 'ok') setOtp('');
    } catch {
      setOtpMsg('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    }
    setOtpBusy(false);
  };

  // QR แบบเดียวกับ PromptPay (มีป้ายแดงตรงกลาง)
  useEffect(() => {
    if (canvasRef.current) drawQr(canvasRef.current, pending.url, qrLabel(pending.game, pending.gameId)).catch(console.error);
  }, [pending.url, pending.game, pending.gameId]);

  // ถามบอทว่าเงินเข้าหรือยัง (บอทยืนยันกับ TrueMoney แล้วถึงตอบว่าจ่ายแล้ว)
  useEffect(() => {
    let stopped = false;
    let timer;
    const tick = async () => {
      try {
        const r = await fetch(`/api/truemoney-status?code=${encodeURIComponent(pending.id)}`);
        const d = await r.json();
        if (stopped) return;
        if (d.status === 'cancelled') { alert(d.message || 'รายการนี้ถูกยกเลิก'); onDone(); return; }
        if (d.status === 'delivered') {
          setBonus(Number(d.bonus) || 0);
          setStatus('delivered');
          savePending(null);
          return;
        }
        if (d.status === 'paid') setStatus('paid'); // ถามต่อจนบอทส่งเหรียญเสร็จ
        else if (d.status === 'review') { // จ่ายแล้ว รอยืนยัน → ถามต่อจนส่งจริง
          setStatus('review');
          setOtpInfo(d.otp ? { phone: d.phone } : null);
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, 5000);
    };
    timer = setTimeout(tick, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending.id]);

  const paid = status === 'paid' || status === 'delivered';
  const review = status === 'review';

  return (
    <>
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} bonus={bonus} />}
      <div className="bs-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <h1 className="bs-h1" style={{ fontSize: 28 }}>{paid ? 'กำลังส่งเหรียญ' : review ? 'รอตรวจสอบ' : 'โอนทรูมันนี่'}</h1>
      </div>
      <OrderBox
        pending={pending}
        visible={status !== 'waiting'}
        fallbackAt={pending.expiresAt ? (pending.expiresAt - 30 * 60 + 3 * 60) * 1000 : 0}
      />

      <div className="bs-qrbox">
        <div className="bs-muted" style={{ fontSize: 12.5 }}>ยอดโอน</div>
        <div className="big">{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}<small>บาท</small></div>
        <div className="bs-gold" style={{ font: '700 14px/1.4 Prompt,sans-serif' }}>{formatChips(pending.chips, pending.game)} เหรียญ</div>
      </div>

      <div style={{ marginTop: 16 }}>
        {paid ? (
          <div className="bs-alert good" style={{ display: 'flex', gap: 8 }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>ได้รับเงินแล้ว ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</span>
          </div>
        ) : review && otpInfo ? (
          <div className="bs-alert info">
            <b>ได้รับเงินแล้ว ✅ ยืนยันตัวตนครั้งแรก</b>
            <p className="bs-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              ร้านส่งรหัส 6 หลักทาง SMS ไปที่เบอร์ทรูมันนี่ที่โอน ({otpInfo.phone}) กรอกรหัสเพื่อรับเหรียญทันที
            </p>
            <p style={{ fontSize: 12.5, marginTop: 6, color: 'var(--warn)' }}>
              ⚠️ ถ้ามีคนอื่นขอรหัสนี้จากคุณ หรือคุณไม่ได้กำลังเติมเกมให้ไอดีของตัวเอง ห้ามให้รหัส = มิจฉาชีพ
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="รหัส 6 หลัก" aria-label="รหัส OTP 6 หลัก" className="bs-otp"
              />
              <button type="button" disabled={otpBusy || otp.length !== 6} onClick={() => otpCall('verify')}
                      className="bs-btn primary" style={{ width: 'auto', padding: '12px 18px', fontSize: 15 }}>
                ยืนยัน
              </button>
            </div>
            {otpMsg && <p style={{ fontSize: 12.5, marginTop: 8 }}>{otpMsg}</p>}
            <button type="button" disabled={otpBusy} onClick={() => otpCall('resend')} className="bs-link" style={{ marginTop: 8, fontSize: 12 }}>
              ไม่ได้รับ SMS? ขอรหัสใหม่
            </button>
          </div>
        ) : review ? (
          <div className="bs-alert warn">
            ได้รับเงินแล้ว ✅ ร้านกำลังตรวจสอบก่อนส่งเหรียญ (ไอดีใหม่หรือเบอร์ผู้โอนใหม่ ตรวจครั้งแรกครั้งเดียว)
            <br />ทักแชทเพจ BOSS STORE พร้อมรหัส <b>#{pending.id}</b> จะได้รับเหรียญเร็วขึ้น
          </div>
        ) : (
          <>
            {pending.verified === false && (
              <div className="bs-alert info" style={{ fontSize: 12.5, marginBottom: 12 }}>
                {pending.amount > 300
                  ? 'ไอดีนี้เติมครั้งแรก ยอดเกิน 300 บาท: ร้านจะตรวจสอบก่อนส่งเหรียญ (ทักแชทเพจพร้อมรหัสออเดอร์เพื่อให้เร็วขึ้น)'
                  : 'ไอดีนี้เติมครั้งแรก: หลังโอน จะมีรหัสยืนยันทาง SMS ไปที่เบอร์ทรูมันนี่ที่ใช้โอน กรอกในหน้านี้เพื่อรับเหรียญ'}
                {' '}(ป้องกันมิจฉาชีพ ทำครั้งแรกครั้งเดียว) ครั้งต่อไปจากเบอร์เดิมได้รับเหรียญทันที
              </div>
            )}
            <ol className="bs-steps">
              <li><i>1</i><span>กดปุ่มด้านล่าง เปิดแอปทรูมันนี่ (ยอดและข้อความกรอกไว้ให้แล้ว)</span></li>
              <li><i>2</i><span>ห้ามแก้<b>จำนวนเงิน</b>และ<b>ข้อความ</b> ในหน้าโอน ไม่งั้นระบบส่งเหรียญอัตโนมัติไม่ได้</span></li>
              <li><i>3</i><span>โอนเสร็จ กลับมาหน้านี้ เหรียญเข้าอัตโนมัติ</span></li>
            </ol>
            <a href={pending.url} target="_blank" rel="noopener noreferrer" className="bs-btn tmn" style={{ marginTop: 18 }}>
              เปิดแอป TrueMoney เพื่อโอน <ArrowRight className="w-4 h-4" />
            </a>
            <p className="bs-cap" style={{ marginTop: 14 }}>ใช้คอมอยู่? สแกน QR นี้ด้วยกล้องมือถือ</p>
            <div className="bs-qr" style={{ marginTop: 4 }}>
              <canvas ref={canvasRef} className="w-56 h-auto sm:w-60 block" />
            </div>
            <p className="bs-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <Loader2 className="w-5 h-5 bs-spin" /> รอการโอนเงิน...
            </p>
          </>
        )}
      </div>

      <div className="bs-row" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {paid ? (
          <>
            <span>ติดปัญหาเรื่องเหรียญ แจ้งเพจพร้อมรหัสด้านบน</span>
            <button type="button" onClick={onDone} className="bs-link muted" style={{ whiteSpace: 'nowrap', flex: 'none' }}>🏠 {t('goHome')}</button>
          </>
        ) : (
          <>
            <span>โอนแล้วไม่ขึ้นใน 3 นาที ทักเพจพร้อมรหัสด้านบน</span>
            <button onClick={() => { savePending(null); onCancel(); }} className="bs-link muted">ยกเลิก</button>
          </>
        )}
      </div>
    </>
  );
}

const METHODS = [
  { key: 'promptpay', label: 'PromptPay', sub: 'สแกน QR แอปธนาคาร' },
  { key: 'truemoney', label: 'TrueMoney', sub: 'โอนผ่านแอปทรูมันนี่' },
];

export default function App() {
  const [recentIds, setRecentIds] = useState(loadRecent);
  // เปิดเว็บมา: ใส่ไอดีล่าสุดของเกมเริ่มต้น (Royal) ให้เลย
  const [gameId, setGameId] = useState(() => (loadRecent().royal || [])[0] || '');
  const updateRecent = (fn) => setRecentIds((prev) => { const next = fn(prev); saveRecent(next); return next; });
  const rememberId = (g, id) => updateRecent((prev) => ({
    ...prev, [g]: [id, ...(prev[g] || []).filter((x) => x !== id)].slice(0, RECENT_MAX),
  }));
  const forgetId = (g, id) => {
    updateRecent((prev) => ({ ...prev, [g]: (prev[g] || []).filter((x) => x !== id) }));
    setGameId((cur) => (cur === id ? '' : cur));
  };
  // สลับเกม: ถ้าช่องว่าง หรือเป็นไอดีที่จำไว้ของเกมก่อน → เปลี่ยนเป็นไอดีล่าสุดของเกมใหม่
  const switchGame = (from, to) => {
    if (from === to) return;
    setGameId((cur) => (!cur || (recentIds[from] || []).includes(cur) ? (recentIds[to] || [])[0] || '' : cur));
  };
  const [method, setMethod] = useState('promptpay');
  const [customAmount, setCustomAmount] = useState('50');  // 18 พ.ย. ร้านสั่ง: เตรียมยอด 50 บาทไว้ให้  // 18 พ.ย.: เตรียมยอดขั้นต่ำไว้ให้ กดต่อได้เลย
  const [bankAcc, setBankAcc] = useState(() => {
    // 18 พ.ย.: จำบัญชี/ธนาคารที่ใช้ล่าสุด → ลูกค้าประจำไม่ต้องกรอกซ้ำ
    try { return JSON.parse(localStorage.getItem('bossstore_last_customer') || '{}').bankAcc || ''; } catch { return ''; }
  });
  const [bankCode, setBankCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bossstore_last_customer') || '{}').bankCode || ''; } catch { return ''; }
  });
  const [bankTouched, setBankTouched] = useState(false);  // ลูกค้าลืมกรอก → ขอบแดงเตือน
  const [bankHistory, setBankHistory] = useState([]);  // 17 พ.ย. ร้านสั่ง: จำบัญชีที่เคยกรอก มากสุด 3 รายการ [{code, acc}]
  const bankInfo = BANKS.find((b) => b.code === bankCode);
  const bankLen = bankInfo ? bankInfo.len : 10;  // 'อื่นๆ' = 10–15
  const bankAccOk = bankInfo && (bankInfo.len ? bankAcc.length === bankInfo.len : bankAcc.length >= 10 && bankAcc.length <= 15);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bossstore_banks') || '[]');
      if (Array.isArray(saved)) {
        // รูปแบบใหม่ "รหัส|เลข" · รูปแบบเก่า (เลขอย่างเดียว) = ยังไม่รู้ธนาคาร ให้ลูกค้าเลือกเอง
        setBankHistory(saved.map((x) => {
          const [c, a] = String(x).includes('|') ? String(x).split('|') : ['', String(x)];
          return { code: BANKS.some((b) => b.code === c) ? c : '', acc: a };
        }).filter((x) => /^\d{10,15}$/.test(x.acc)).slice(0, 3));
      }
    } catch { /* เพิกเฉย */ }
  }, []);

  const rememberBank = (code, value) => {
    const v = String(value || '').replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(v)) return;
    const next = [{ code, acc: v }, ...bankHistory.filter((x) => x.acc !== v)].slice(0, 3);
    setBankHistory(next);
    try { localStorage.setItem('bossstore_banks', JSON.stringify(next.map((x) => `${x.code}|${x.acc}`))); } catch { /* เพิกเฉย */ }
  };
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(loadPending);
  // 20 พ.ย. ร้านสั่ง: ลิงก์กู้ออเดอร์ ?order=รหัส (ร้านส่งให้ลูกค้าตอนขอสลิปยืนยัน 0.10 บาท)
  // ลูกค้าเปิดจากแชท/เบราว์เซอร์อื่นที่ไม่มีออเดอร์ค้างในเครื่อง → เปิดหน้าชำระเงินเดิม ไม่เด้งหน้าแรก
  useEffect(() => {
    let code = '';
    try { code = (new URLSearchParams(window.location.search).get('order') || '').toUpperCase(); } catch { return; }
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    const clearParam = () => {
      try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ข้ามได้ */ }
    };
    const cur = loadPending();
    if (cur && cur.id === code) { clearParam(); return; }
    fetch(`/api/order-info?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        clearParam();
        if (d && d.found && d.id === code) {
          savePending(d);
          setPending(d);
        } else {
          alert('ไม่พบรายการนี้ หรือรายการหมดอายุแล้ว กรุณาทักแชทเพจ BOSS STORE');
        }
      })
      .catch(() => {});
  }, []);
  const [showPackages, setShowPackages] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // 12 พ.ย.: ค้นไอดีในเกมก่อนจ่าย ให้ลูกค้าเห็นตัวละคร (กันกรอกไอดีผิด) { status: checking|found|not_found|skip, image }
  const [playerCheck, setPlayerCheck] = useState({ status: 'skip' });
  const [game, setGame] = useState('royal');
  // เกมที่ร้านเปิดรับ (ปิดชั่วคราวได้จากแผงควบคุมที่คอมร้าน) ถามทุก 60 วิ
  const [openGames, setOpenGames] = useState(() => Object.fromEntries(GAME_KEYS.map((k) => [k, true])));
  // ช่องทางจ่ายที่เปิดอยู่ (ร้านปิดปรับปรุงได้จากแผงควบคุม)
  const [openMethods, setOpenMethods] = useState(() => Object.fromEntries(METHODS.map((m) => [m.key, true])));
  // ติดต่อคอมร้านไม่ได้ (ไฟดับ/เน็ตหลุด) → ปิดรับเงินทั้งหมด กันลูกค้าจ่ายแล้วไม่ได้เหรียญ
  const [offline, setOffline] = useState(false);
  // โปรแถมเหรียญ (ร้านเปิดในแผงควบคุม) { on, bonus, min_baht, scope } หรือ null
  const [promo, setPromo] = useState(null);
  // โหมดมืด/สว่าง (ร้านสั่ง 12 พ.ย.: เริ่มต้นโหมดมืด · จำค่าที่ลูกค้าเลือกไว้ในเครื่อง)
  const [theme, setTheme] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('theme');
      if (q === 'light' || q === 'dark') return q;
      return localStorage.getItem('bossstore_theme2') === 'light' ? 'light' : 'dark';
    } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    try { localStorage.setItem('bossstore_theme2', theme); } catch { /* ข้ามได้ */ }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const d = await (await fetch('/api/shop-status')).json();
        if (stopped) return;
        if (d.games) setOpenGames((prev) => ({ ...prev, ...d.games }));
        if (d.methods) setOpenMethods((prev) => ({ ...prev, ...d.methods }));
        setOffline(!!d.offline);
        setPromo(d.promo && (d.promo.royal || d.promo.siam) ? d.promo : null); // { royal, siam } เฉพาะเกมที่เปิดโปร
      } catch {}
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // เกมที่เลือกอยู่ถูกปิด → สลับไปเกมที่เปิดอยู่ให้เอง
  useEffect(() => {
    if (!openGames[game]) {
      const next = GAME_KEYS.find((k) => openGames[k]);
      if (next) setGame(next);
    }
  }, [openGames, game]);

  // ช่องทางที่เลือกอยู่ถูกปิด → สลับไปช่องทางที่เปิดอยู่ให้เอง
  useEffect(() => {
    if (!openMethods[method]) {
      const next = METHODS.find((m) => openMethods[m.key]);
      if (next) setMethod(next.key);
    }
  }, [openMethods, method]);

  const gameOpen = !!openGames[game];
  const methodOpen = !!openMethods[method];
  const gameInfo = GAMES[game];
  // 9 พ.ย.: ลูกค้าเลือก Siam แต่ใส่ไอดี Royal (8 หลัก) → จ่ายแล้วส่งไม่ได้ ไอดี Siam ที่ขายมาทั้งหมดมี 7 หลัก
  const wrongGameHint = game === 'siam' && gameId.length >= 8;
  const MIN_BAHT = minBaht(game);
  const PACKAGES = gameInfo.packages;
  const baht = Number(customAmount);
  const chipsAmount = chipsFor(baht, game);

  // ค้นไอดีในเกม (Royal) ใช้ร่วมกันระหว่าง "ค้นล่วงหน้า" กับป๊อปอัปยืนยัน: ไอดีเดียวกันค้นครั้งเดียว
  const lookups = useRef(new Map());
  const lookupPlayer = (g, id) => {
    const key = `${g}:${id}`;
    if (!lookups.current.has(key)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const p = fetch(`/api/check-id?game=${g}&id=${encodeURIComponent(id)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .catch(() => ({ status: 'unknown' }))
        .finally(() => clearTimeout(timer));
      lookups.current.set(key, p);
      // ผลไม่แน่นอน (ร้านไม่ว่าง/ถามไม่ได้) → ไม่จำ ให้ลองใหม่ได้
      p.then((d) => { if (!['found', 'not_found'].includes(d.status)) lookups.current.delete(key); });
    }
    return lookups.current.get(key);
  };

  // 12 พ.ย. ค้นล่วงหน้า: ลูกค้าหยุดพิมพ์ไอดี ~1 วิ → เริ่มค้นเลย (ระหว่างกรอกยอดเงิน) กด "สร้าง QR" แล้วชื่อขึ้นทันที
  // ดีไซน์ใหม่: โชว์ผลในช่องไอดีด้วย (✓ ตรวจแล้ว / ไม่พบในเกม)
  const [idCheck, setIdCheck] = useState({ key: '', status: '' });
  useEffect(() => {
    if (!CHECK_ID_GAMES.includes(game) || !/^\d{6,12}$/.test(gameId)) return undefined;
    const key = `${game}:${gameId}`;
    let alive = true;
    const t = setTimeout(() => {
      setIdCheck({ key, status: 'checking' });
      lookupPlayer(game, gameId).then((d) => { if (alive) setIdCheck({ key, status: d.status }); });
    }, 1000);
    return () => { alive = false; clearTimeout(t); };
  }, [game, gameId]);
  const idState = idCheck.key === `${game}:${gameId}` ? idCheck.status : '';

  // เปิดป๊อปอัปยืนยัน → ใช้ผลค้น (ที่ค้นล่วงหน้าไว้/กำลังค้นอยู่) ถามไม่ได้/ช้า → skip = ไปต่อได้เหมือนเดิม
  useEffect(() => {
    if (!confirming || !CHECK_ID_GAMES.includes(game)) {
      setPlayerCheck({ status: 'skip' });
      return undefined;
    }
    let alive = true;
    let timer;
    setPlayerCheck({ status: 'checking' });
    // 21 พ.ย. ร้านแจ้ง "บางทีรูปไม่ขึ้น": ร้านไม่ว่าง/ถามไม่ได้ → ลองใหม่อีก 2 ครั้ง (ห่าง 3 วิ) ก่อนยอมข้าม
    const attempt = (left) => lookupPlayer(game, gameId).then((d) => {
      if (!alive) return;
      if (d.status === 'found' && d.image) setPlayerCheck({ status: 'found', image: d.image });
      else if (d.status === 'not_found') setPlayerCheck({ status: 'not_found' });
      else if (left > 0 && ['busy', 'unknown'].includes(d.status)) timer = setTimeout(() => attempt(left - 1), 3000);
      else setPlayerCheck({ status: 'skip' });
    });
    attempt(2);
    return () => { alive = false; clearTimeout(timer); };
  }, [confirming, game, gameId]);

  // กดชำระ → ตรวจข้อมูล → ป๊อปอัปให้ลูกค้ายืนยันไอดีก่อน
  const handleCheckout = (e) => {
    e.preventDefault();

    if (!gameOpen) {
      alert(`ขออภัย ${gameInfo.name} ปิดรับออเดอร์ชั่วคราว`);
      return;
    }
    if (!methodOpen) {
      alert('ขออภัย ช่องทางชำระเงินปิดปรับปรุงชั่วคราว');
      return;
    }
    if (!/^\d{4,12}$/.test(gameId)) {
      alert('กรุณากรอกไอดีเกมเป็นตัวเลขให้ถูกต้อง');
      return;
    }

    if (!Number.isInteger(baht) || baht < MIN_BAHT || baht > MAX_BAHT) {
      alert(`กรุณาระบุจำนวนเงินเป็นจำนวนเต็ม ${MIN_BAHT}–${MAX_BAHT.toLocaleString()} บาท`);
      return;
    }

    setConfirming(true);
  };

  // ยืนยันไอดีแล้ว → สร้าง QR PromptPay / ลิงก์ TrueMoney แล้วแสดงบนหน้านี้เลย
  const createPayment = async () => {
    if (method !== 'truemoney' && !bankAccOk) {
      setBankTouched(true);  // ขอบแดง + ข้อความเตือนใต้ช่อง
      return;
    }
    if (method !== 'truemoney') rememberBank(bankCode, bankAcc);  // เก็บประวัติไว้เลือกครั้งหน้า
    setConfirming(false);
    setLoading(true);

    try {
      const response = await fetch(method === 'truemoney' ? '/api/create-truemoney' : '/api/create-promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, amount: baht, game, bank: method === 'truemoney' ? '' : bankAcc,
          bankCode: method === 'truemoney' || bankCode === 'other' ? '' : bankCode, lang: currentLang() })
      });

      const data = await response.json();

      if (data.id && (data.qrData || data.url)) {
        rememberId(game, gameId);
        try { localStorage.setItem('bossstore_last_customer', JSON.stringify({ game, gameId, bankCode, bankAcc })); } catch { /* เพิกเฉย */ }
        savePending(data);
        setPending(data);
      } else {
        if (data.offline) setOffline(true);
        if (data.closed) setOpenGames((prev) => ({ ...prev, [data.closed]: false }));
        if (data.closedMethod) setOpenMethods((prev) => ({ ...prev, [data.closedMethod]: false }));
        alert('เกิดข้อผิดพลาด: ' + (data.error || 'ไม่สามารถสร้างรายการชำระเงินได้'));
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('ไม่สามารถเชื่อมต่อกับระบบชำระเงินได้');
    }
    setLoading(false);
  };

  const done = () => {
    // 18 พ.ย. ร้านสั่ง: กด "ตกลง" ในป๊อปอัปสำเร็จ → กลับหน้าแรกสุด (ล้างฟอร์ม/ไอดี/ธนาคาร)
    savePending(null);
    setPending(null);
    setCustomAmount('');
    setGameId('');
    setPlayerCheck({ status: 'idle' });
    setConfirming(false);
    setBankAcc('');
    setBankCode('');
    setBankTouched(false);
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* เพิกเฉย */ }
  };
  const shell = (children, caption) => (
    <div className="bs-page">
      <style>{STYLE_CSS}</style>
      <div className="bs-wrap">
        {caption && <p className="bs-cap">{caption}</p>}
        <div className="bs-card">
          <Header theme={theme} onToggle={toggleTheme} />
          {children}
        </div>
      </div>
    </div>
  );

  if (pending) {
    return shell(
      pending.method === 'truemoney' ? (
        <TrueMoneyCard pending={pending} onDone={done} onCancel={() => setPending(null)} />
      ) : pending.method === 'promptpay_bank' ? (
        <BankPromptPayCard pending={pending} onDone={done} onCancel={() => setPending(null)} />
      ) : (
        <PaymentCard pending={pending} onDone={done} onCancel={() => setPending(null)} />
      ),
    );
  }

  const presets = [MIN_BAHT, 50, 100, 300, 500];
  const methodSub = { promptpay: 'สแกน QR แอปธนาคาร แล้วอัปโหลดสลิป', truemoney: 'เปิดแอปจ่ายในคลิกเดียว' };

  return shell(
    <>
      {/* ป๊อปอัปเตือนให้ตรวจไอดีก่อนชำระเงิน */}
      {confirming && (
        <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={() => setConfirming(false)}>
          <div className="bs-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-title" className="bs-h2">{t('confirmTitle')}</h2>
            <p className="bs-sub" style={{ marginTop: 4 }}>{t('confirmWarn')}</p>

            <div className="bs-qrbox" style={{ marginTop: 14, textAlign: 'center', background: 'var(--card2)' }}>
              <div className="bs-muted" style={{ fontSize: 12 }}>ไอดีผู้เล่น {gameInfo.name}</div>
              <div className="bs-idbig" style={{ marginTop: 4 }}>{gameId}</div>
            </div>

            {playerCheck.status === 'checking' && (
              <div className="bs-alert info" style={{ marginTop: 10, display: 'flex', gap: 8 }} role="status">
                <Loader2 className="w-5 h-5 bs-spin shrink-0" /> กำลังค้นหาไอดีนี้ในเกม (อาจใช้เวลาสักครู่)...
              </div>
            )}
            {playerCheck.status === 'found' && (
              <div className="bs-alert good" style={{ marginTop: 10 }}>
                <b>✓ {t('found')}</b>
                <img src={playerCheck.image} alt={`ตัวละครในเกม ไอดี ${gameId}`} className="mx-auto w-full max-w-[300px] rounded-lg" style={{ marginTop: 8 }} />
                <div className="bs-muted" style={{ fontSize: 12, marginTop: 6 }}>{t('foundHint')}</div>
              </div>
            )}
            {playerCheck.status === 'not_found' && (
              <div className="bs-alert bad" style={{ marginTop: 10 }}>
                <b>✗ ไม่พบไอดี {gameId} ในเกม {gameInfo.name}</b>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  ตัวเลขอาจขาด เกิน หรือสลับกัน กด "แก้ไขไอดี" แล้วคัดลอกไอดีจากหน้าโปรไฟล์ในเกมมาวางอีกครั้ง
                </div>
              </div>
            )}
            {wrongGameHint && (
              <div className="bs-alert bad" style={{ marginTop: 10 }}>
                <b>⚠️ เลือกเกม Siam แต่ไอดีมี {gameId.length} หลัก</b>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  ไอดี Siam ปกติมี 7 หลัก ไอดีนี้น่าจะเป็นของ <b>Royal</b> ถ้าจ่ายผิดเกม ระบบส่งเหรียญไม่ได้ กด "แก้ไขไอดี" แล้วเลือกเกมให้ถูก
                </div>
              </div>
            )}

            <div className="bs-row" style={{ marginTop: 12, justifyContent: 'center', flexWrap: 'wrap', gap: '4px 10px' }}>
              <span>{gameInfo.name}</span>·<span><b className="bs-ink">{baht.toLocaleString()} บาท</b></span>·
              <span className="bs-gold" style={{ fontWeight: 700 }}>{formatChips(chipsAmount, game)} เหรียญ</span>·
              <span>{method === 'truemoney' ? 'TrueMoney' : 'พร้อมเพย์'}</span>
            </div>

            {method !== 'truemoney' && (
              <div style={{ marginTop: 12 }}>
                {/* ร้านสั่ง 18 พ.ย.: เตือนตั้งแต่ก่อนสร้าง QR ว่าต้องเป็นบัญชีตัวเอง (กันโกงสามเส้า) */}
                <div className="bs-alert warn" style={{ fontSize: 13, fontWeight: 700, padding: '8px 12px', marginBottom: 10 }}>
                  {t('bankOwn')}
                </div>
                {bankHistory.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {bankHistory.map((v) => {
                      const on = bankAcc === v.acc && bankCode === v.code;
                      const b = BANKS.find((x) => x.code === v.code);
                      return (
                        <button
                          key={v.acc}
                          type="button"
                          onClick={() => { setBankAcc(v.acc); if (v.code) setBankCode(v.code); setBankTouched(true); }}
                          style={{
                            border: `1.5px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                            background: on ? 'var(--card)' : 'var(--card2)',
                            color: 'var(--ink)', borderRadius: 999, padding: '7px 12px',
                            fontSize: 12.5, fontWeight: 700, letterSpacing: .4, cursor: 'pointer',
                          }}
                        >
                          🏦 {b && b.code !== 'other' ? `${b.name} ` : ''}{v.acc.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 19 พ.ย. ร้านสั่ง: เปลี่ยนปุ่มธนาคาร 9 ปุ่ม → dropdown ช่องเดียว ประหยัดพื้นที่ */}
  <div style={{ marginTop: 12 }}>
    <label htmlFor="bankCode" style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>
      {t('bankPick')} <span style={{ color: 'var(--red)' }}>*</span>
    </label>
    <select
      id="bankCode"
      value={bankCode}
      onChange={(e) => {
        const c = e.target.value;
        setBankCode(c);
        const b = BANKS.find((x) => x.code === c);
        if (b && b.len) setBankAcc((a) => a.slice(0, b.len));
        setBankTouched(true);
      }}
      onBlur={() => setBankTouched(true)}
      aria-invalid={bankTouched && !bankCode}
      style={{
        width: '100%', padding: '13px 38px 13px 14px', borderRadius: 14, appearance: 'none', WebkitAppearance: 'none',
        border: `2px solid ${bankTouched && !bankCode ? 'var(--red)' : 'var(--line)'}`,
        background: bankTouched && !bankCode ? 'var(--bad-bg)' : 'var(--card2)',
        color: bankCode ? 'var(--ink)' : 'var(--muted)', fontSize: 15, fontWeight: 700, outline: 'none',
        backgroundImage: 'linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)',
        backgroundPosition: 'calc(100% - 19px) calc(50% + 1px), calc(100% - 13px) calc(50% + 1px)',
        backgroundSize: '6px 6px, 6px 6px', backgroundRepeat: 'no-repeat',
      }}
    >
      <option value="">{t('bankPickPlaceholder')}</option>
      {BANKS.map((b) => (
        <option key={b.code} value={b.code}>
          {b.code === 'other' ? t('bankOther') : b.name}{b.len ? ` (${b.len} หลัก)` : ''}
        </option>
      ))}
    </select>
  </div>

  <label htmlFor="bankAcc" style={{ fontSize: 14, fontWeight: 800, display: 'block', margin: '12px 0 6px', color: 'var(--ink)' }}>
                  {t('bankLabel')} <span style={{ color: 'var(--red)' }}>* {bankInfo && !bankInfo.len ? t('digitAny') : t(bankLen === 12 ? 'digit12' : 'digit10')}</span>
                </label>
                <input
                  id="bankAcc"
                  type="tel"
                  inputMode="numeric"
                  maxLength={bankInfo && bankInfo.len ? bankInfo.len : 15}
                  value={bankAcc}
                  onChange={(e) => { setBankAcc(e.target.value.replace(/\D/g, '').slice(0, bankInfo && bankInfo.len ? bankInfo.len : 15)); setBankTouched(true); }}
                  onBlur={() => setBankTouched(true)}
                  placeholder={bankLen === 12 ? 'กรอก 12 หลัก เช่น 020012345678' : 'กรอก 10 หลัก เช่น 1234567890'}
                  aria-invalid={bankTouched && !bankAccOk}
                  style={{
                    width: '100%', padding: '13px 14px', borderRadius: 14,
                    border: `2px solid ${bankTouched && !bankAccOk ? 'var(--red)' : 'var(--line)'}`,
                    background: bankTouched && !bankAccOk ? 'var(--bad-bg)' : 'var(--card2)',
                    color: 'var(--ink)', fontSize: 17, letterSpacing: 1.2, fontWeight: 700,
                    boxShadow: bankTouched && !bankAccOk ? '0 0 0 3px rgba(220,38,38,.15)' : 'none',
                    outline: 'none',
                  }}
                />

                {bankTouched && !bankCode ? (
                  <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--red)', fontWeight: 700 }}>
                    ⚠️ {t('bankPickErr')}
                  </div>
                ) : bankTouched && !bankAccOk ? (
                  <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--red)', fontWeight: 700 }}>
                    ⚠️ {bankInfo && !bankInfo.len ? t('bankErrAny') : t(bankLen === 12 ? 'bankErr12' : 'bankErr')}
                  </div>
                ) : /^0[689]\d{8}$/.test(bankAcc) ? (
                  // ลูกค้ามักใส่เบอร์พร้อมเพย์ → เลขท้ายไม่ตรงสลิป โดนกัก · เตือนแต่ไม่บล็อก (บางบัญชีขึ้นต้นแบบนี้ได้)
                  <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--warn, #d97706)', fontWeight: 700 }}>
                    ⚠️ {t('bankPhone')}
                  </div>
                ) : (
                  <div className="bs-muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                    {t('bankHint')}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {playerCheck.status === 'not_found' ? (
                <button type="button" onClick={() => setConfirming(false)} autoFocus className="bs-btn primary">{t('edit')}</button>
              ) : (
                <>
                  <button type="button" onClick={createPayment} disabled={playerCheck.status === 'checking'} autoFocus className="bs-btn primary">
                    {playerCheck.status === 'checking' ? t('checking')
                      : playerCheck.status === 'found' ? t('contFound') : t('cont')}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="bs-btn ghost">แก้ไขไอดี</button>
                </>
              )}
              {playerCheck.status === 'not_found' && (
                <button type="button" onClick={createPayment} className="bs-link muted" style={{ fontSize: 12 }}>
                  ฉันมั่นใจว่าไอดีถูกต้อง ดำเนินการต่อ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bs-titlerow">
        <h1 className="bs-h1">{t('h1a')}<br />{t('h1b')}</h1>
        {/* เตือนโกงสามเส้า (ร้านขอ 12 พ.ย. ย้ายมาที่ว่างขวาบน · ใจความเดิม 8 พ.ย.) */}
        <div className="bs-scam" role="note">
          <span aria-hidden="true">⚠️</span>
          <b>{t('scam')}</b>
        </div>
      </div>
      <p className="bs-sub">{t('sub')}</p>

      <form onSubmit={handleCheckout} style={{ marginTop: 18, display: 'grid', gap: 18 }}>
        {/* เลือกเกม */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="เลือกเกม">
          {GAME_KEYS.map((key) => {
            const on = game === key;
            const open = openGames[key];
            return (
              <button key={key} type="button" role="radio" aria-checked={on && open} disabled={!open}
                      onClick={() => { switchGame(game, key); setGame(key); setShowPackages(false); }} className="bs-opt">
                {on && open && <span className="bs-tag">{t('selected')}</span>}
                <b><span className="bs-gdot" style={{ background: key === 'siam' ? 'var(--siam)' : 'var(--royal)' }} />{GAMES[key].short}</b>
                <span className="s" style={!open ? { color: 'var(--warn)' } : undefined}>
                  {open ? `${t('startFrom')} ${minBaht(key)} ${t('baht')}` : t('closedNow')}
                </span>
              </button>
            );
          })}
        </div>

        {/* โปรแถม แยกต่อเกม (ร้านสั่ง 13 พ.ย.) — ขึ้นเฉพาะเกมที่ร้านเปิดโปร */}
        {(() => {
          const p = promo && promo[game];
          if (!p || !(p.bonus > 0) || offline) return null;
          return (
            <div className="bs-promo" role="note">
              <span className="ic" aria-hidden="true">🎁</span>
              <div>
                <b>โปรโมชั่น! แถมฟรี {formatChips(p.bonus, game)} เหรียญ</b>
                <span>
                  {p.scope === 'new' ? 'ไอดีที่ยังไม่เคยเติมกับร้าน' : 'ทุกไอดี'} รับได้ไอดีละ 1 ครั้ง
                  {p.min_baht > minBaht(game) ? ` · เติมขั้นต่ำ ${p.min_baht} บาท` : ''} · ส่งรวมไปพร้อมเหรียญที่ซื้อ
                </span>
              </div>
            </div>
          );
        })()}

        {/* ไอดีเกม */}
        <div>
          <label htmlFor="gameid" className="bs-label">{t('id')} {gameInfo.short}<small>4–12</small></label>
          <div style={{ position: 'relative' }}>
            <input
              id="gameid" type="text" inputMode="numeric" maxLength={12} value={gameId}
              onChange={(e) => setGameId(e.target.value.replace(/\D/g, ''))}
              placeholder="เช่น 8129121" className="bs-input" style={{ paddingRight: 110 }} required
            />
            {idState === 'checking' && <span className="bs-check bs-muted">กำลังตรวจ…</span>}
            {idState === 'found' && <span className="bs-check" style={{ color: 'var(--good)' }}>✓ ตรวจแล้ว</span>}
            {idState === 'not_found' && <span className="bs-check" style={{ color: 'var(--bad)' }}>✗ ไม่พบในเกม</span>}
          </div>
          {(recentIds[game] || []).length > 0 && (
            <div className="bs-recent">
              <span className="lbl">ไอดีที่เคยเติม</span>
              {(recentIds[game] || []).map((id) => (
                <span key={id} className={'chip' + (id === gameId ? ' on' : '')}>
                  <button type="button" className="id" onClick={() => setGameId(id)}>{id}</button>
                  <button type="button" className="x" aria-label={`ลบไอดี ${id} ออกจากประวัติ`} onClick={() => forgetId(game, id)}>×</button>
                </span>
              ))}
            </div>
          )}
          {idState === 'not_found' && (
            <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--bad)' }}>ไม่พบไอดีนี้ในเกม {gameInfo.short} ตรวจตัวเลขอีกครั้ง</p>
          )}
          {wrongGameHint && (
            <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--warn)' }}>
              ⚠️ ไอดี Siam ปกติมี 7 หลัก ไอดีนี้มี {gameId.length} หลัก อาจเป็นไอดี <b>Royal</b> ตรวจสอบเกมที่เลือกอีกครั้ง
            </p>
          )}
        </div>

        {/* ยอดเงิน */}
        <div>
          <div className="bs-amount">
            <div className="top"><label htmlFor="amount">ยอดที่ต้องการเติม</label><span>พิมพ์เองได้</span></div>
            <input
              id="amount" type="number" inputMode="numeric" value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)} placeholder="พิมพ์จำนวนเงิน"
              required min={MIN_BAHT} max={MAX_BAHT} step="1" aria-describedby="amount-coins"
            />
            <div className="unit">บาท</div>
            <div className="coins" id="amount-coins">
              {chipsAmount ? `${formatChips(chipsAmount, game)} เหรียญ` : `ขั้นต่ำ ${MIN_BAHT} บาท`}
              {chipsAmount ? <div className="note">{rateNote(baht, game)}</div> : null}
            </div>
            <div className="bs-chips">
              {presets.map((v) => (
                <button key={v} type="button" className="bs-chipbtn" aria-pressed={baht === v} onClick={() => setCustomAmount(String(v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setShowPackages((v) => !v)} className="bs-link muted"
                  style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }} aria-expanded={showPackages}>
            ดูแพ็กเกจราคา {gameInfo.short} ทั้งหมด ({PACKAGES.length} แพ็กเกจ)
            <ChevronDown className={`w-4 h-4 transition-transform ${showPackages ? 'rotate-180' : ''}`} />
          </button>
          {showPackages && (
            <div className="bs-pkg">
              {PACKAGES.map((p) => (
                <button key={p.baht} type="button" aria-pressed={p.baht === baht}
                        onClick={() => { setCustomAmount(String(p.baht)); setShowPackages(false); }}>
                  <span>{formatChips(p.chips, game)}</span><b>{p.baht}฿</b>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ช่องทางชำระเงิน */}
        <div className="bs-methods" role="radiogroup" aria-label="ช่องทางชำระเงิน">
          {METHODS.map((m) => {
            const open = openMethods[m.key];
            const on = method === m.key && open;
            return (
              <button key={m.key} type="button" role="radio" aria-checked={on} disabled={!open}
                      onClick={() => setMethod(m.key)} className={`bs-method ${m.key === 'promptpay' ? 'pp' : ''}`}>
                <span className="bs-radio" aria-hidden="true" />
                <span>
                  <b>{m.key === 'promptpay' ? 'พร้อมเพย์' : 'TrueMoney'}</b>
                  <span className="s" style={!open ? { color: 'var(--warn)' } : undefined}>
                    {open ? methodSub[m.key] : 'ปิดปรับปรุงชั่วคราว'}
                  </span>
                </span>
                {m.key === 'promptpay' && open && <span className="bs-badge">เร็วสุด</span>}
              </button>
            );
          })}
        </div>

        {offline ? (
          <div className="bs-alert warn" style={{ textAlign: 'center' }}>
            ขออภัย ระบบเติมเหรียญปิดชั่วคราว (กำลังแก้ไข) กรุณาลองใหม่ภายหลัง ยังไม่มีการเรียกเก็บเงิน
          </div>
        ) : !gameOpen ? (
          <div className="bs-alert warn" style={{ textAlign: 'center' }}>ขออภัย ตอนนี้ปิดรับออเดอร์ทุกเกมชั่วคราว</div>
        ) : !methodOpen && (
          <div className="bs-alert warn" style={{ textAlign: 'center' }}>ขออภัย ช่องทางชำระเงินปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง</div>
        )}

        <button type="submit" disabled={loading || offline || !gameOpen || !methodOpen}
                className={`bs-btn primary ${method === 'promptpay' ? 'pp' : ''}`}>
          {loading
            ? (method === 'truemoney' ? 'กำลังสร้างลิงก์...' : 'กำลังสร้าง QR...')
            : method === 'truemoney' ? 'จ่ายผ่าน TrueMoney' : 'สร้าง QR พร้อมเพย์'}
        </button>
      </form>

      <div className="bs-trust">
        <span>ตรวจไอดีก่อนส่ง</span>
        <span>{method === 'truemoney' ? 'ตรวจยอดกับ TrueMoney' : 'สลิปปลอมไม่ผ่าน'}</span>
        <span>ทักเพจได้ 24 ชม.</span>
      </div>
    </>,
  );
}
