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
      <button type="button" onClick={onClose} className="mt-5 text-indigo-300 underline underline-offset-4">
        ปิด
      </button>
    </div>
  );
}

// ป๊อปอัปเมื่อบอทส่งเหรียญเข้าไอดีเสร็จจริง กด "ตกลง" กลับหน้าแรก
function DeliveredPopup({ pending, onOk }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="delivered-title">
      <div className="w-full max-w-sm bg-[#161a2b] border border-emerald-500/50 rounded-2xl p-6 shadow-2xl text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
        <h2 id="delivered-title" className="mt-3 text-xl font-bold text-emerald-300">ส่งเหรียญเสร็จแล้ว</h2>
        <p className="mt-3 text-sm text-gray-200 leading-relaxed">
          <span className="text-pink-400 font-bold">{formatChips(pending.chips, pending.game)} เหรียญ</span>
          <br />
          เข้า {gameOf(pending.game).name} ไอดี <span className="text-yellow-300 font-bold">{pending.gameId}</span> แล้ว
        </p>
        <p className="mt-2 text-xs text-gray-400">เข้าเกมตรวจกล่องของขวัญได้เลย ขอบคุณที่ใช้บริการ BOSS STORE</p>
        <button
          type="button"
          autoFocus
          onClick={onOk}
          className="mt-5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 rounded-xl"
        >
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
    <div className="w-full max-w-md rounded-2xl overflow-hidden border border-indigo-500/30 shadow-2xl bg-[#161a2b]">
      <div className="bg-gradient-to-br from-violet-500 to-indigo-600 px-6 py-5">
        <h1 className="text-2xl font-bold">เติมเหรียญ</h1>
        <p className="text-sm text-indigo-100 mt-1">ใส่ไอดีผู้เล่น กรอกจำนวนเงิน แล้วสแกน QR PromptPay</p>
      </div>

      <div className="px-6 py-6 flex flex-col items-center">
        <div className="w-full bg-[#22273a] rounded-xl py-3 text-center">
          เติม <span className="font-bold">{gameOf(pending.game).name}</span> ให้ไอดี{' '}
          <span className="text-yellow-400 font-bold">{pending.gameId}</span>
        </div>

        <p className="mt-5 text-sm text-gray-300">ยอดชำระ</p>
        <p className="text-3xl font-bold mt-1">
          ฿{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-pink-400 mt-1">{formatChips(pending.chips, pending.game)} เหรียญ</p>

        <div className={`mt-4 bg-white rounded-2xl p-3 ${dead ? 'opacity-30' : ''}`}>
          <canvas ref={canvasRef} className="w-64 h-64 sm:w-72 sm:h-72 block" />
        </div>

        {paid ? (
          <div className="mt-5 w-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>ชำระเงินสำเร็จ ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</span>
          </div>
        ) : dead ? (
          <p className="mt-5 text-sm text-gray-300">
            {status === 'expired' ? 'QR หมดอายุแล้ว' : 'ยกเลิกรายการแล้ว'} ยังไม่มีการเรียกเก็บเงิน
          </p>
        ) : (
          <p className="mt-5 text-sm text-gray-200 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            รอการชำระเงิน... สแกนด้วยแอปธนาคาร
          </p>
        )}

        <div className="mt-4 flex gap-6 text-sm">
          {paid || dead ? (
            <button onClick={onDone} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
              {paid ? 'เติมเพิ่ม' : 'สร้าง QR ใหม่'}
            </button>
          ) : (
            <>
              <button onClick={saveQr} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
                บันทึก QR
              </button>
              <button
                onClick={cancel}
                disabled={cancelling}
                className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200 disabled:opacity-50"
              >
                {cancelling ? 'กำลังยกเลิก...' : 'ยกเลิก / แก้ไขยอด'}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400">ชำระเงินอย่างปลอดภัยผ่าน Stripe</p>
      </div>
    </div>
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

// พร้อมเพย์ธนาคารร้าน: สแกนจ่าย → อัปโหลดสลิป → บอทตรวจสลิปกับธนาคาร (Slip2Go) แล้วส่งเหรียญ
function BankPromptPayCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  // idle = รอโอน/อัปโหลด, checking = กำลังตรวจ, paid, review = ร้านตรวจไอดีใหม่, locked
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [msgBad, setMsgBad] = useState(false);

  useEffect(() => {
    if (canvasRef.current) drawQr(canvasRef.current, pending.qrData, qrLabel(pending.game, pending.gameId)).catch(console.error);
  }, [pending.qrData, pending.game, pending.gameId]);

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
      } else {
        setStatus(d.status === 'locked' ? 'locked' : 'idle');
        setMsgBad(true);
      }
    } catch {
      setStatus('idle');
      setMsgBad(true);
      setMsg('อ่านไฟล์หรือเชื่อมต่อไม่ได้ กรุณาเลือกภาพสลิปใหม่อีกครั้ง');
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
  const review = status === 'review';
  const checking = status === 'checking';
  const locked = status === 'locked';

  return (
    <div className="w-full max-w-md rounded-2xl overflow-hidden border border-indigo-500/30 shadow-2xl bg-[#161a2b]">
      <QrPreview src={preview} onClose={() => setPreview(null)} />
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} />}
      <div className="bg-gradient-to-br from-violet-500 to-indigo-600 px-6 py-5">
        <h1 className="text-2xl font-bold">เติมเหรียญผ่านพร้อมเพย์</h1>
        <p className="text-sm text-indigo-100 mt-1">สแกนจ่ายด้วยแอปธนาคาร แล้วอัปโหลดสลิป</p>
      </div>

      <div className="px-6 py-6 flex flex-col items-center">
        <div className="w-full bg-[#22273a] rounded-xl py-3 text-center">
          เติม <span className="font-bold">{gameOf(pending.game).name}</span> ให้ไอดี{' '}
          <span className="text-yellow-400 font-bold">{pending.gameId}</span>
        </div>

        <p className="mt-5 text-sm text-gray-300">ยอดโอน (ต้องตรงตามนี้)</p>
        <p className="text-3xl font-bold mt-1">
          ฿{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-pink-400 mt-1">{formatChips(pending.chips, pending.game)} เหรียญ</p>

        {!paid && !review && (
          <div className="mt-4 bg-white rounded-2xl p-3">
            <canvas ref={canvasRef} className="w-64 h-64 sm:w-72 sm:h-72 block" />
          </div>
        )}

        {paid ? (
          <div className="mt-5 w-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>ตรวจสลิปผ่าน ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</span>
          </div>
        ) : review ? (
          <div className="mt-5 w-full bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
            <span>
              ได้รับเงินแล้ว ✅ ร้านกำลังตรวจสอบไอดีก่อนส่งเหรียญ (ลูกค้าใหม่ตรวจครั้งแรกครั้งเดียว ครั้งต่อไปได้ทันที)
              <br />ไม่ต้องอัปโหลดซ้ำ หน้านี้จะเปลี่ยนเองเมื่อส่งเหรียญ
            </span>
          </div>
        ) : (
          <>
            <ol className="mt-5 w-full text-sm text-gray-200 space-y-1 list-decimal list-inside">
              <li>สแกน QR หรือบันทึก QR ไปเปิดในแอปธนาคาร</li>
              <li>โอนยอด <span className="font-bold">{pending.amount.toLocaleString()} บาท</span> ตรงตามนี้</li>
              <li>กดปุ่มด้านล่าง เลือกภาพสลิปจากแอปธนาคาร</li>
            </ol>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={checking || locked}
              onClick={() => fileRef.current?.click()}
              className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> กำลังตรวจสลิปกับธนาคาร...
                </>
              ) : (
                '📎 โอนแล้ว อัปโหลดสลิป'
              )}
            </button>
            {msg && (
              <p className={`mt-3 text-sm text-center ${msgBad ? 'text-red-400' : 'text-emerald-300'}`}>{msg}</p>
            )}
            <p className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
              ระบบตรวจสลิปกับธนาคารอัตโนมัติ สลิปปลอม/สลิปเก่า/ยอดไม่ตรงจะไม่ผ่าน
              <br />อัปโหลดได้ภายใน 24 ชม. (ปิดหน้านี้แล้วกลับมาใหม่ได้)
            </p>
          </>
        )}

        <div className="mt-4 flex gap-6 text-sm">
          {paid ? (
            <button onClick={onDone} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
              เติมเพิ่ม
            </button>
          ) : review ? null : (
            <>
              <button onClick={saveQr} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
                บันทึก QR
              </button>
              <button onClick={cancel} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
                ยกเลิก / แก้ไขยอด
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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
    <div className="w-full max-w-md rounded-2xl overflow-hidden border border-orange-500/30 shadow-2xl bg-[#161a2b]">
      {status === 'delivered' && <DeliveredPopup pending={pending} onOk={onDone} />}
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-5">
        <h1 className="text-2xl font-bold">เติมเหรียญผ่าน TrueMoney</h1>
        <p className="text-sm text-orange-50 mt-1">กดปุ่มเปิดแอปทรูมันนี่ ยอดและข้อความกรอกไว้ให้แล้ว</p>
      </div>

      <div className="px-6 py-6 flex flex-col items-center">
        <div className="w-full bg-[#22273a] rounded-xl py-3 text-center">
          เติม <span className="font-bold">{gameOf(pending.game).name}</span> ให้ไอดี{' '}
          <span className="text-yellow-400 font-bold">{pending.gameId}</span>
        </div>

        <p className="mt-5 text-sm text-gray-300">ยอดโอน</p>
        <p className="text-3xl font-bold mt-1">
          ฿{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-pink-400 mt-1">{formatChips(pending.chips, pending.game)} เหรียญ</p>

        {paid ? (
          <div className="mt-5 w-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>ได้รับเงินแล้ว ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)</span>
          </div>
        ) : review && otpInfo ? (
          <div className="mt-5 w-full bg-[#22273a] border border-orange-500/40 rounded-xl px-4 py-4">
            <p className="text-sm text-gray-100 font-semibold">ได้รับเงินแล้ว ✅ ยืนยันตัวตนครั้งแรก</p>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              ร้านส่งรหัส 6 หลักทาง SMS ไปที่เบอร์ทรูมันนี่ที่โอน ({otpInfo.phone}) กรอกรหัสเพื่อรับเหรียญทันที
            </p>
            <p className="text-xs text-amber-300 mt-2 leading-relaxed">
              ⚠️ ถ้ามีคนอื่นขอรหัสนี้จากคุณ หรือคุณไม่ได้กำลังเติมเกมให้ไอดีของตัวเอง ห้ามให้รหัส = มิจฉาชีพ
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="รหัส 6 หลัก"
                aria-label="รหัส OTP 6 หลัก"
                className="flex-1 min-w-0 bg-[#1a243f] border border-gray-700 rounded-xl px-4 py-3 text-white text-lg tracking-widest focus:outline-none focus:border-orange-400"
              />
              <button
                type="button"
                disabled={otpBusy || otp.length !== 6}
                onClick={() => otpCall('verify')}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold px-5 rounded-xl disabled:opacity-50"
              >
                ยืนยัน
              </button>
            </div>
            {otpMsg && <p className="text-xs text-gray-200 mt-2">{otpMsg}</p>}
            <button
              type="button"
              disabled={otpBusy}
              onClick={() => otpCall('resend')}
              className="mt-3 text-xs text-orange-300 underline underline-offset-4 disabled:opacity-50"
            >
              ไม่ได้รับ SMS? ขอรหัสใหม่
            </button>
          </div>
        ) : review ? (
          <div className="mt-5 w-full bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-xl px-4 py-3 leading-relaxed">
            ได้รับเงินแล้ว ✅ ร้านกำลังตรวจสอบก่อนส่งเหรียญ (ไอดีใหม่หรือเบอร์ผู้โอนใหม่ ตรวจครั้งแรกครั้งเดียว)
            <br />ทักแชทเพจ BOSS STORE พร้อมรหัส <b>#{pending.id}</b> จะได้รับเหรียญเร็วขึ้น
          </div>
        ) : (
          <>
            {pending.verified === false && (
              <div className="mt-5 w-full bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs rounded-xl px-4 py-3 leading-relaxed">
                {pending.amount > 300
                  ? 'ไอดีนี้เติมครั้งแรก ยอดเกิน 300 บาท: ร้านจะตรวจสอบก่อนส่งเหรียญ (ทักแชทเพจพร้อมรหัสออเดอร์เพื่อให้เร็วขึ้น)'
                  : 'ไอดีนี้เติมครั้งแรก: หลังโอน จะมีรหัสยืนยันทาง SMS ไปที่เบอร์ทรูมันนี่ที่ใช้โอน กรอกในหน้านี้เพื่อรับเหรียญ'}
                {' '}(ป้องกันมิจฉาชีพ ทำครั้งแรกครั้งเดียว) ครั้งต่อไปจากเบอร์เดิมได้รับเหรียญทันที
              </div>
            )}
            <a
              href={pending.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              เปิดแอป TrueMoney เพื่อโอน <ArrowRight className="w-4 h-4" />
            </a>
            <p className="mt-4 text-xs text-gray-400">ใช้คอมอยู่? สแกน QR นี้ด้วยกล้องมือถือ</p>
            <div className="mt-2 bg-white rounded-2xl p-3">
              <canvas ref={canvasRef} className="w-64 h-64 sm:w-72 sm:h-72 block" />
            </div>
            <div className="mt-4 w-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl px-4 py-3 leading-relaxed">
              ⚠️ ห้ามแก้ไข<b>จำนวนเงิน</b>และ<b>ข้อความ</b> (เติมเกม{gameOf(pending.game).tmnWord} เพจBOSS STORE ID {pending.gameId} #{pending.id})
              ในหน้าโอน ไม่งั้นระบบส่งเหรียญอัตโนมัติไม่ได้
            </div>
            <p className="mt-5 text-sm text-gray-200 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
              รอการโอนเงิน...
            </p>
          </>
        )}

        <div className="mt-4 flex gap-6 text-sm">
          {paid ? (
            <button onClick={onDone} className="text-orange-300 underline underline-offset-4 hover:text-orange-200">
              เติมเพิ่ม
            </button>
          ) : (
            <button
              onClick={() => { savePending(null); onCancel(); }}
              className="text-orange-300 underline underline-offset-4 hover:text-orange-200"
            >
              ยกเลิก / แก้ไขยอด
            </button>
          )}
        </div>
        {!paid && (
          <p className="mt-3 text-xs text-gray-500 text-center">
            ถ้าโอนแล้วแต่ไม่ขึ้นภายใน 5 นาที ทักแอดมินพร้อมรหัส #{pending.id}
          </p>
        )}
      </div>
    </div>
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
  const [game, setGame] = useState('royal');
  // เกมที่ร้านเปิดรับ (ปิดชั่วคราวได้จากแผงควบคุมที่คอมร้าน) ถามทุก 60 วิ
  const [openGames, setOpenGames] = useState(() => Object.fromEntries(GAME_KEYS.map((k) => [k, true])));
  // ช่องทางจ่ายที่เปิดอยู่ (ร้านปิดปรับปรุงได้จากแผงควบคุม)
  const [openMethods, setOpenMethods] = useState(() => Object.fromEntries(METHODS.map((m) => [m.key, true])));
  // ติดต่อคอมร้านไม่ได้ (ไฟดับ/เน็ตหลุด) → ปิดรับเงินทั้งหมด กันลูกค้าจ่ายแล้วไม่ได้เหรียญ
  const [offline, setOffline] = useState(false);

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
  const MIN_BAHT = minBaht(game);
  const PACKAGES = gameInfo.packages;
  const baht = Number(customAmount);
  const chipsAmount = chipsFor(baht, game);

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

  if (pending) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b0f19] to-[#1b1340] text-white flex flex-col items-center py-10 px-4">
        {pending.method === 'truemoney' ? (
          <TrueMoneyCard
            pending={pending}
            onDone={() => { savePending(null); setPending(null); setCustomAmount(''); }}
            onCancel={() => setPending(null)}
          />
        ) : pending.method === 'promptpay_bank' ? (
          <BankPromptPayCard
            pending={pending}
            onDone={() => { savePending(null); setPending(null); setCustomAmount(''); }}
            onCancel={() => setPending(null)}
          />
        ) : (
          <PaymentCard
            pending={pending}
            onDone={() => { savePending(null); setPending(null); setCustomAmount(''); }}
            onCancel={() => setPending(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center py-10 px-4">
      {/* ป๊อปอัปเตือนให้ตรวจไอดีก่อนชำระเงิน */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm bg-[#161a2b] border border-yellow-500/40 rounded-2xl p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl">⚠️</div>
            <h2 id="confirm-title" className="mt-2 text-lg font-bold text-yellow-400">
              โปรดตรวจสอบไอดีของลูกค้าให้ถูกต้อง
            </h2>
            <p className="mt-1 text-xs text-gray-400">ถ้าไอดีผิด เหรียญจะถูกส่งไปไอดีอื่นและเรียกคืนไม่ได้</p>

            <div className="mt-4 bg-[#22273a] rounded-xl py-3">
              <p className="text-xs text-gray-400">ไอดีผู้เล่น</p>
              <p className="text-3xl font-bold tracking-wider text-yellow-300 mt-1">{gameId}</p>
            </div>
            <p className="mt-3 text-sm text-gray-300">
              เกม <span className="font-bold text-yellow-300">{gameInfo.name}</span> ·{' '}
              ยอด <span className="font-bold text-white">{baht.toLocaleString()} บาท</span> ·{' '}
              <span className="text-pink-400 font-bold">{formatChips(chipsAmount, game)} เหรียญ</span> ·{' '}
              {method === 'truemoney' ? 'TrueMoney' : 'PromptPay'}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={createPayment}
                autoFocus
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold py-3 rounded-xl transition"
              >
                ไอดีถูกต้อง ดำเนินการต่อ
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="w-full bg-[#1a243f] border border-gray-700 hover:border-gray-500 text-gray-200 py-3 rounded-xl transition"
              >
                แก้ไขไอดี
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-md bg-[#131b2e] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" /> BOSS STORE
          </h1>
          <span className="text-xs bg-purple-600/30 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full">
            ⚡ ระบบอัตโนมัติ 24 ชม.
          </span>
        </div>

        {/* เตือนโกงสามเส้า: เหยื่อที่ถูกส่งลิงก์ร้านมาให้จ่ายค่าของอย่างอื่น ต้องเห็นก่อนจ่าย */}
        <div className="mb-5 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 text-xs text-red-200 leading-relaxed" role="note">
          <span className="font-bold text-red-300">⚠️ ระวังมิจฉาชีพ</span> · ร้านขายเฉพาะ<b>เหรียญเกม</b> ·
          ถ้ามีคนส่งลิงก์หรือ QR ของร้านนี้ให้คุณจ่ายเพื่อซื้อสินค้าอื่น หรือไอดีเกมไม่ใช่ของคุณเอง
          <b> ห้ามจ่าย = มิจฉาชีพ</b>
        </div>

        <form onSubmit={handleCheckout} className="space-y-5">
          {/* เลือกเกม */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">1. เลือกเกม</label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="เลือกเกม">
              {GAME_KEYS.map((key) => {
                const on = game === key;
                const open = openGames[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!open}
                    onClick={() => { setGame(key); setShowPackages(false); }}
                    className={`rounded-xl px-3 py-2.5 border transition text-center ${
                      !open
                        ? 'bg-[#1a243f] border-gray-800 opacity-50 cursor-not-allowed'
                        : on ? 'bg-yellow-500/15 border-yellow-400' : 'bg-[#1a243f] border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className={`block font-bold ${on && open ? 'text-yellow-300' : 'text-gray-200'}`}>{GAMES[key].name}</span>
                    <span className={`block text-xs mt-0.5 ${open ? 'text-gray-400' : 'text-amber-300'}`}>
                      {open ? `ขั้นต่ำ ${minBaht(key)} บาท` : 'ปิดชั่วคราว'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ช่องกรอกไอดีเกม */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              2. ไอดีผู้เล่น {gameInfo.name} (Game ID)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              value={gameId}
              onChange={(e) => setGameId(e.target.value.replace(/\D/g, ''))}
              placeholder="เช่น 8129121"
              className="w-full bg-[#1a243f] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
              required
            />
          </div>

          {/* ช่องกรอกจำนวนเงินเอง */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              3. ระบุจำนวนเงิน (บาท)
            </label>
            <div className="relative">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={`ขั้นต่ำ ${MIN_BAHT}`}
                className="w-full bg-[#1a243f] border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-white text-lg font-semibold focus:outline-none focus:border-purple-500 transition"
                required
                min={MIN_BAHT}
                max={MAX_BAHT}
                step="1"
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-bold">฿</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💎 จำนวนเหรียญที่จะได้รับ: <span className="text-pink-400 font-bold">{formatChips(chipsAmount, game)} เหรียญ</span>
              <span className="block mt-1 text-gray-500">
                ขั้นต่ำ {MIN_BAHT} บาท
                {chipsAmount ? ` · ${rateNote(baht, game)}` : ''}
              </span>
            </p>

            {/* เมนูเปิดดูแพ็กเกจ */}
            <button
              type="button"
              onClick={() => setShowPackages((v) => !v)}
              className="mt-3 w-full flex items-center justify-between bg-[#1a243f] border border-gray-700 hover:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-gray-200 transition"
              aria-expanded={showPackages}
            >
              <span>📋 ดูแพ็กเกจราคา {gameInfo.short} ({PACKAGES.length} แพ็กเกจ)</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showPackages ? 'rotate-180' : ''}`} />
            </button>
            {showPackages && (
              <div className="mt-2 grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
                {PACKAGES.map((p) => {
                  const selected = p.baht === baht;
                  return (
                    <button
                      key={p.baht}
                      type="button"
                      onClick={() => { setCustomAmount(String(p.baht)); setShowPackages(false); }}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm border transition ${
                        selected
                          ? 'bg-purple-600/30 border-purple-400'
                          : 'bg-[#1a243f] border-gray-700 hover:border-purple-500'
                      }`}
                    >
                      <span className="font-semibold text-pink-300">{formatChips(p.chips, game)}</span>
                      <span className="font-bold text-yellow-400">{p.baht}฿</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* เลือกช่องทางชำระเงิน */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">4. ช่องทางชำระเงิน</label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {METHODS.map((m) => {
                const open = openMethods[m.key];
                const on = method === m.key && open;
                const tmn = m.key === 'truemoney';
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!open}
                    onClick={() => setMethod(m.key)}
                    className={`rounded-xl px-3 py-2.5 text-left border transition ${
                      !open
                        ? 'bg-[#1a243f] border-gray-800 opacity-50 cursor-not-allowed'
                        : on
                          ? tmn ? 'bg-orange-500/20 border-orange-400' : 'bg-purple-600/30 border-purple-400'
                          : 'bg-[#1a243f] border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className={`block font-bold text-sm ${tmn ? 'text-orange-300' : 'text-indigo-200'}`}>{m.label}</span>
                    <span className={`block text-xs mt-0.5 ${open ? 'text-gray-400' : 'text-amber-300'}`}>
                      {open ? m.sub : 'ปิดปรับปรุงชั่วคราว'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ปุ่มกดชำระเงิน */}
          {offline ? (
            <p className="text-sm text-amber-300 text-center">
              ขออภัย ระบบเติมเหรียญปิดชั่วคราว (กำลังแก้ไข) กรุณาลองใหม่ภายหลัง ยังไม่มีการเรียกเก็บเงิน
            </p>
          ) : !gameOpen ? (
            <p className="text-sm text-amber-300 text-center">ขออภัย ตอนนี้ปิดรับออเดอร์ทุกเกมชั่วคราว</p>
          ) : !methodOpen && (
            <p className="text-sm text-amber-300 text-center">ขออภัย ช่องทางชำระเงินปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง</p>
          )}
          <button
            type="submit"
            disabled={loading || offline || !gameOpen || !methodOpen}
            className={`w-full text-white font-medium py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 ${
              method === 'truemoney'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
            }`}
          >
            {loading ? (
              method === 'truemoney' ? 'กำลังสร้างลิงก์...' : 'กำลังสร้าง QR...'
            ) : method === 'truemoney' ? (
              <>
                <CreditCard className="w-5 h-5" /> ชำระผ่าน TrueMoney <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> สร้าง QR ชำระเงิน PromptPay <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {method === 'truemoney' ? 'ระบบตรวจสอบยอดโอนกับ TrueMoney อัตโนมัติ' : 'ระบบตรวจสอบสลิปกับธนาคารอัตโนมัติ'}
        </div>
      </div>
    </div>
  );
}
