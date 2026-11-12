import React, { useEffect, useRef, useState } from 'react';
import { ShoppingBag, CreditCard, ShieldCheck, ArrowRight, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
// ตารางเรทเดียวกับ server (server เป็นตัวตัดสินจริง หน้าเว็บใช้แสดงผล)
import { GAMES, GAME_KEYS, MAX_BAHT, chipsFor, rateNote, formatChips, minBaht, gameOf } from '../api/_rates.js';

const POLL_MS = 3000;
const STORAGE_KEY = 'bossstore_pending_qr';

// ข้อความกลาง QR (QR ใช้ระดับแก้ผิด H ทนการบังได้ราว 30%)
// ใส่เกม + ไอดีที่ลูกค้ากรอก กันโกงสามเส้า: คนที่ได้รูป QR ต่อมาจะเห็นว่ากำลังจ่ายเติมเกมให้ไอดีไหน
// (ครอบตัดป้ายออก QR จะสแกนไม่ได้) ขนาดกล่อง/ตัวอักษรเท่าป้ายเดิมที่ทดสอบสแกนแล้ว
// เกมที่บอทค้นตัวละครให้ดูก่อนจ่ายได้ (12 พ.ย. เพิ่ม Siam หลังร้านล็อกอินบัญชี VIP ในจอรับเหรียญ)
const CHECK_ID_GAMES = ['royal', 'siam'];

function qrLabel(game, gameId) {
  return [`เติม ${gameOf(game).name}`, `ID ${gameId}`, 'ร้าน BOSS STORE'];
}

function loadPending() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (p && p.expiresAt && p.expiresAt * 1000 > Date.now()) return p;
  } catch {}
  return null;
}
function savePending(p) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

async function drawQr(canvas, data, label) {
  const size = 600;
  await QRCode.toCanvas(canvas, data, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });
  // qrcode ใส่ style กว้าง 600px ทับ class ไว้ ล้างออกให้ขนาดตาม CSS
  canvas.style.width = '';
  canvas.style.height = '';
  const ctx = canvas.getContext('2d');
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
  const lineH = boxH / (label.length + 0.4);
  label.forEach((line, i) => {
    ctx.fillText(line, size / 2, y + lineH * (i + 0.7), boxW - 12);
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
function OrderCode({ id, visible, fallbackAt = 0, gameName = '', gameId = '' }) {
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
  const copyText = `เติม ${gameName} ให้ไอดี ${gameId} #${id}`;
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
function OrderBox({ pending, visible = true, fallbackAt = 0 }) {
  return (
    <div className="bs-orderbox">
      <p className="t">เติม <b>{gameOf(pending.game).name}</b> ให้ไอดี <b className="id">{pending.gameId}</b></p>
      <OrderCode id={pending.id} gameName={gameOf(pending.game).name} gameId={pending.gameId}
        visible={visible} fallbackAt={fallbackAt} />
    </div>
  );
}

// ป๊อปอัปเมื่อบอทส่งเหรียญเข้าไอดีเสร็จจริง กด "ตกลง" กลับหน้าแรก
function DeliveredPopup({ pending, onOk }) {
  return (
    <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="delivered-title">
      <div className="bs-card" style={{ textAlign: 'center' }}>
        <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: 'var(--good)' }} />
        <h2 id="delivered-title" className="bs-h2" style={{ marginTop: 10 }}>ส่งเหรียญเสร็จแล้ว</h2>
        <p className="bs-gold" style={{ marginTop: 12, font: '800 26px/1.2 Prompt,sans-serif' }}>
          {formatChips(pending.chips, pending.game)} เหรียญ
        </p>
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
          <canvas ref={canvasRef} className="w-60 h-60 sm:w-64 sm:h-64 block" />
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
          <button onClick={onDone} className="bs-link">{paid ? 'เติมเพิ่ม' : 'สร้าง QR ใหม่'}</button>
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
.bs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.bs-logo{display:flex;align-items:center;gap:8px;font:800 17px/1 Prompt,sans-serif;letter-spacing:.2px;color:var(--ink)}
.bs-logo i{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);display:grid;place-items:center;font-style:normal;font-size:12px}
.bs-pill{display:inline-flex;align-items:center;gap:6px;font:600 12px/1 Prompt,sans-serif;color:var(--ink)}
.bs-dot{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 25%,transparent)}
.bs-moon{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--card2);color:var(--ink);
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
.bs-qr{background:#fff;border-radius:16px;padding:8px;margin:14px auto 0;width:fit-content}
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
.bs-steps li i{flex:none;width:22px;height:22px;border-radius:50%;background:var(--ink);color:var(--card);font:700 12px/22px Prompt,sans-serif;text-align:center;font-style:normal}
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

// หัวการ์ด: โลโก้ BOSS STORE + ไฟเขียว 24 ชม. + ปุ่มธีม (ทุกหน้าใช้เหมือนกัน)
function Header({ theme, onToggle, right }) {
  return (
    <div className="bs-head">
      <div className="bs-logo"><i aria-hidden="true">B</i>BOSS STORE</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {right || <span className="bs-pill"><span className="bs-dot" aria-hidden="true" />24 ชม.</span>}
        {onToggle && <ThemeToggle theme={theme} onToggle={onToggle} />}
      </div>
    </div>
  );
}

// พร้อมเพย์ธนาคารร้าน: สแกนจ่าย → อัปโหลดสลิป → บอทตรวจสลิปกับธนาคาร (Slip2Go) แล้วส่งเหรียญ
function BankPromptPayCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  // idle = รอโอน/อัปโหลด, checking = กำลังตรวจ, paid, review = ร้านตรวจไอดีใหม่, locked
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [msgBad, setMsgBad] = useState(false);
  // QR ใช้ได้ 10 นาที (กันเซฟ QR ไว้ให้คนอื่นจ่ายทีหลัง) หมดแล้วยังอัปโหลดสลิปได้ถ้าโอนไปแล้ว
  const qrDeadline = (pending.qrExpiresAt || pending.expiresAt) * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
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
        if (d.status === 'delivered') {
          setStatus('delivered');
          savePending(null);
          return;
        }
        if (d.status === 'paid') setStatus('paid'); // ถามต่อจนบอทส่งเหรียญเสร็จ
        if (d.status === 'review') setStatus((s) => (s === 'checking' ? s : 'review'));
        // บอทกำลังรอธนาคารยืนยันสลิป (ตรวจซ้ำเองทุกไม่กี่นาที)
        if (d.status === 'checking') setStatus((s) => (s === 'checking' ? s : 'bankwait'));
        // บอทตรวจซ้ำเองแล้วไม่ผ่าน → ให้อัปโหลดใหม่/ทักเพจ
        if (d.status === 'failed') {
          setStatus((s) => (s === 'bankwait' ? 'idle' : s));
          setMsg(d.message || 'ตรวจสลิปไม่ผ่าน กรุณาทักแชทเพจ BOSS STORE พร้อมสลิป');
          setMsgBad(true);
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
        body: JSON.stringify({ code: pending.id, image }),
      });
      const d = await r.json();
      setMsg(d.message || '');
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
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} />}

      <div className="bs-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <h1 className="bs-h1" style={{ fontSize: 28 }}>
          {paid ? 'กำลังส่งเหรียญ' : review ? 'รอตรวจสอบ' : 'สแกนจ่าย'}
        </h1>
      </div>
      <OrderBox pending={pending} visible={status !== 'idle' || !!msg}
        fallbackAt={pending.qrExpiresAt ? (pending.qrExpiresAt - 10 * 60 + 3 * 60) * 1000 : 0} />

      <div className="bs-qrbox">
        <div className="bs-muted" style={{ fontSize: 12.5 }}>ยอดที่ต้องโอน (ต้องตรงตามนี้)</div>
        <div className="big">{money}<small>บาท</small></div>
        <div className="bs-gold" style={{ font: '700 14px/1.4 Prompt,sans-serif' }}>{formatChips(pending.chips, pending.game)} เหรียญ</div>
        {!paid && !review && !qrExpired && (
          <>
            <div className="bs-qr">
              <canvas ref={canvasRef} className="w-60 h-60 sm:w-64 sm:h-64 block" />
            </div>
            <p className={`bs-timer ${secondsLeft <= 60 ? 'low' : ''}`}>
              เหลือ<b>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</b>นาทีก่อน QR หมดอายุ
            </p>
          </>
        )}
        {!paid && !review && qrExpired && (
          <div className="bs-alert bad" style={{ marginTop: 12, textAlign: 'center' }}>
            <b>QR หมดอายุแล้ว (ใช้ได้ 10 นาที)</b>
            <div style={{ fontSize: 12, marginTop: 4 }}>ยังไม่ได้โอน → สร้าง QR ใหม่ · โอนไปแล้ว → อัปโหลดสลิปด้านล่าง</div>
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
            <span>ตรวจสลิปผ่าน ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</span>
          </div>
        ) : review ? (
          <div className="bs-alert warn" style={{ display: 'flex', gap: 8 }}>
            <Loader2 className="w-5 h-5 shrink-0 bs-spin" />
            <span>
              {bankwait
                ? 'ได้รับสลิปแล้ว ⏳ กำลังรอธนาคารยืนยันรายการ (ปกติ 1–10 นาที)'
                : msg && !msgBad
                  ? msg
                  : 'ได้รับเงินแล้ว ✅ ร้านกำลังตรวจสอบไอดีก่อนส่งเหรียญ (ลูกค้าใหม่ตรวจครั้งแรกครั้งเดียว ครั้งต่อไปได้ทันที)'}
              <br />ไม่ต้องอัปโหลดซ้ำ หน้านี้จะเปลี่ยนเองเมื่อส่งเหรียญ
            </span>
          </div>
        ) : (
          <>
            <ol className="bs-steps">
              <li><i>1</i><span>สแกน QR ด้วยแอปธนาคาร หรือบันทึกภาพไว้สแกนภายหลัง (ภายใน 10 นาที)</span></li>
              <li><i>2</i><span>โอนยอด <b>{money} บาท</b> ให้ตรงตามที่แสดง</span></li>
              <li><i>3</i><span>อัปโหลดสลิป ระบบตรวจและส่งเหรียญอัตโนมัติ</span></li>
            </ol>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button
              type="button"
              disabled={checking || locked}
              onClick={() => fileRef.current?.click()}
              className={`bs-btn primary ${nudgeUpload && !checking && !locked ? 'upload-nudge' : ''}`}
              style={{ marginTop: 18 }}
            >
              {checking ? (<><Loader2 className="w-5 h-5 bs-spin" /> กำลังตรวจสลิปกับธนาคาร...</>) : 'อัปโหลดสลิป'}
            </button>
            {msg && (
              <div className={`bs-alert ${msgBad ? 'bad' : 'good'}`} style={{ marginTop: 10, textAlign: 'center' }}>{msg}</div>
            )}
            <p className="bs-cap" style={{ marginTop: 10, lineHeight: 1.6 }}>
              สลิปปลอม สลิปซ้ำ หรือยอดไม่ตรง ระบบจะไม่ส่งเหรียญ
              <br />อัปโหลดได้ภายใน 24 ชม. (ปิดหน้านี้แล้วกลับมาใหม่ได้)
            </p>
          </>
        )}
      </div>

      <div className="bs-row" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {paid ? (
          <>
            <span>ติดปัญหาเรื่องเหรียญ แจ้งเพจพร้อมรหัสด้านบน</span>
            <button onClick={onDone} className="bs-link">เติมเพิ่ม</button>
          </>
        ) : review ? (
          <span>ติดปัญหาเรื่องเหรียญ แจ้งเพจพร้อมรหัสด้านบน</span>
        ) : (
          <>
            {!qrExpired ? <button onClick={saveQr} className="bs-link">บันทึก QR</button> : <span />}
            <button onClick={cancel} className="bs-link muted">ยกเลิก / แก้ไขยอด</button>
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
        if (d.status === 'delivered') {
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
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} />}
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
              <canvas ref={canvasRef} className="w-56 h-56 sm:w-60 sm:h-60 block" />
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
            <button onClick={onDone} className="bs-link">เติมเพิ่ม</button>
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
  const [gameId, setGameId] = useState('');
  const [method, setMethod] = useState('promptpay');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(loadPending);
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
    setPlayerCheck({ status: 'checking' });
    lookupPlayer(game, gameId).then((d) => {
      if (!alive) return;
      if (d.status === 'found' && d.image) setPlayerCheck({ status: 'found', image: d.image });
      else if (d.status === 'not_found') setPlayerCheck({ status: 'not_found' });
      else setPlayerCheck({ status: 'skip' });
    });
    return () => { alive = false; };
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
    setConfirming(false);
    setLoading(true);

    try {
      const response = await fetch(method === 'truemoney' ? '/api/create-truemoney' : '/api/create-promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, amount: baht, game })
      });

      const data = await response.json();

      if (data.id && (data.qrData || data.url)) {
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

  const done = () => { savePending(null); setPending(null); setCustomAmount(''); };
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
            <h2 id="confirm-title" className="bs-h2">ตรวจไอดีให้ถูกก่อนจ่าย</h2>
            <p className="bs-sub" style={{ marginTop: 4 }}>ถ้าไอดีผิด เหรียญจะถูกส่งไปไอดีอื่นและเรียกคืนไม่ได้</p>

            <div className="bs-qrbox" style={{ marginTop: 14, textAlign: 'center', background: 'var(--card2)' }}>
              <div className="bs-muted" style={{ fontSize: 12 }}>ไอดีผู้เล่น {gameInfo.name}</div>
              <div className="bs-idbig" style={{ marginTop: 4 }}>{gameId}</div>
            </div>

            {playerCheck.status === 'checking' && (
              <div className="bs-alert info" style={{ marginTop: 10, display: 'flex', gap: 8 }} role="status">
                <Loader2 className="w-5 h-5 bs-spin shrink-0" /> กำลังค้นหาไอดีนี้ในเกม (ไม่เกิน 20 วินาที)...
              </div>
            )}
            {playerCheck.status === 'found' && (
              <div className="bs-alert good" style={{ marginTop: 10 }}>
                <b>✓ เจอไอดีนี้ในเกม — ใช่ตัวละครของคุณไหม?</b>
                <img src={playerCheck.image} alt={`ตัวละครในเกม ไอดี ${gameId}`} className="mx-auto w-full max-w-[300px] rounded-lg" style={{ marginTop: 8 }} />
                <div className="bs-muted" style={{ fontSize: 12, marginTop: 6 }}>ถ้าไม่ใช่ชื่อตัวละครของคุณ กด "แก้ไขไอดี"</div>
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
              <div className="bs-alert warn" style={{ marginTop: 10 }}>
                <b>📎 โอนแล้วต้องกลับมาหน้านี้เพื่ออัปโหลดสลิป</b>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>ระบบส่งเหรียญหลังตรวจสลิปเท่านั้น ไม่อัปโหลดสลิป = ยังไม่ได้รับเหรียญ</div>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {playerCheck.status === 'not_found' ? (
                <button type="button" onClick={() => setConfirming(false)} autoFocus className="bs-btn primary">แก้ไขไอดี</button>
              ) : (
                <>
                  <button type="button" onClick={createPayment} disabled={playerCheck.status === 'checking'} autoFocus className="bs-btn primary">
                    {playerCheck.status === 'checking' ? 'กำลังค้นหาไอดี...'
                      : playerCheck.status === 'found' ? 'ใช่ ตัวละครนี้ ดำเนินการต่อ' : 'ไอดีถูกต้อง ดำเนินการต่อ'}
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
        <h1 className="bs-h1">เติมเหรียญ<br />เข้าไอดีในเกม</h1>
        {/* เตือนโกงสามเส้า (ร้านขอ 12 พ.ย. ย้ายมาที่ว่างขวาบน · ใจความเดิม 8 พ.ย.) */}
        <div className="bs-scam" role="note">
          <span aria-hidden="true">⚠️</span>
          <b>ไอดีเกมไม่ใช่ของคุณ ห้ามจ่าย = มิจฉาชีพ</b>
        </div>
      </div>
      <p className="bs-sub">เลือกเกม กรอกไอดี จ่ายผ่านพร้อมเพย์หรือทรูมันนี่ รับเหรียญใน 2 นาที</p>

      <form onSubmit={handleCheckout} style={{ marginTop: 18, display: 'grid', gap: 18 }}>
        {/* เลือกเกม */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="เลือกเกม">
          {GAME_KEYS.map((key) => {
            const on = game === key;
            const open = openGames[key];
            return (
              <button key={key} type="button" role="radio" aria-checked={on && open} disabled={!open}
                      onClick={() => { setGame(key); setShowPackages(false); }} className="bs-opt">
                {on && open && <span className="bs-tag">เลือกอยู่</span>}
                <b><span className="bs-gdot" style={{ background: key === 'siam' ? 'var(--siam)' : 'var(--royal)' }} />{GAMES[key].short}</b>
                <span className="s" style={!open ? { color: 'var(--warn)' } : undefined}>
                  {open ? `เริ่ม ${minBaht(key)} บาท` : 'ปิดชั่วคราว'}
                </span>
              </button>
            );
          })}
        </div>

        {/* ไอดีเกม */}
        <div>
          <label htmlFor="gameid" className="bs-label">ไอดีในเกม {gameInfo.short}<small>ตัวเลข 4–12 หลัก</small></label>
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
