import React, { useEffect, useRef, useState } from 'react';
import { ShoppingBag, CreditCard, ShieldCheck, ArrowRight, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
// ตารางเรทเดียวกับ server (server เป็นตัวตัดสินจริง หน้าเว็บใช้แสดงผล)
import { PACKAGES, MIN_BAHT, MAX_BAHT, chipsFor, rateNote } from '../api/_rates.js';

const POLL_MS = 3000;
const STORAGE_KEY = 'bossstore_pending_qr';

// ข้อความกลาง QR (QR ใช้ระดับแก้ผิด H ทนการบังได้ราว 30%)
const QR_LABEL = ['สำหรับเติม Royal Game', 'และ Siam กับร้าน', 'BOSS STORE'];

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

async function drawQr(canvas, data) {
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
  const lineH = boxH / (QR_LABEL.length + 0.4);
  QR_LABEL.forEach((line, i) => {
    ctx.fillText(line, size / 2, y + lineH * (i + 0.7), boxW - 12);
  });
}

function PaymentCard({ pending, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('requires_action');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (canvasRef.current) drawQr(canvasRef.current, pending.qrData).catch(console.error);
  }, [pending.qrData]);

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
          เติมให้ไอดี <span className="text-yellow-400 font-bold">{pending.gameId}</span>
        </div>

        <p className="mt-5 text-sm text-gray-300">ยอดชำระ</p>
        <p className="text-3xl font-bold mt-1">
          ฿{pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-pink-400 mt-1">{pending.chips.toLocaleString()} เหรียญ</p>

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

export default function App() {
  const [gameId, setGameId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(loadPending);
  const [showPackages, setShowPackages] = useState(false);

  const baht = Number(customAmount);
  const chipsAmount = chipsFor(baht);

  // สร้าง QR PromptPay แล้วแสดงบนหน้านี้เลย
  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!/^\d{4,12}$/.test(gameId)) {
      alert('กรุณากรอกไอดีเกมเป็นตัวเลขให้ถูกต้อง');
      return;
    }

    if (!Number.isInteger(baht) || baht < MIN_BAHT || baht > MAX_BAHT) {
      alert(`กรุณาระบุจำนวนเงินเป็นจำนวนเต็ม ${MIN_BAHT}–${MAX_BAHT.toLocaleString()} บาท`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/create-promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, amount: baht })
      });

      const data = await response.json();

      if (data.id && data.qrData) {
        savePending(data);
        setPending(data);
      } else {
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
        <PaymentCard
          pending={pending}
          onDone={() => { savePending(null); setPending(null); setCustomAmount(''); }}
          onCancel={() => setPending(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center py-10 px-4">
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

        <form onSubmit={handleCheckout} className="space-y-5">
          {/* ช่องกรอกไอดีเกม */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              1. ไอดีผู้เล่น (Game ID)
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
              2. ระบุจำนวนเงิน (บาท)
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
              💎 จำนวนเหรียญที่จะได้รับ: <span className="text-pink-400 font-bold">{chipsAmount.toLocaleString()} เหรียญ</span>
              <span className="block mt-1 text-gray-500">
                ขั้นต่ำ {MIN_BAHT} บาท
                {chipsAmount ? ` · ${rateNote(baht)}` : ''}
              </span>
            </p>

            {/* เมนูเปิดดูแพ็กเกจ */}
            <button
              type="button"
              onClick={() => setShowPackages((v) => !v)}
              className="mt-3 w-full flex items-center justify-between bg-[#1a243f] border border-gray-700 hover:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-gray-200 transition"
              aria-expanded={showPackages}
            >
              <span>📋 ดูแพ็กเกจราคา ({PACKAGES.length} แพ็กเกจ)</span>
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
                      <span className="font-semibold text-pink-300">{p.chips.toLocaleString()}</span>
                      <span className="font-bold text-yellow-400">{p.baht}฿</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ปุ่มกดชำระเงิน */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              'กำลังสร้าง QR...'
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> สร้าง QR ชำระเงิน PromptPay <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> ชำระเงินปลอดภัยผ่าน Stripe PromptPay
        </div>
      </div>
    </div>
  );
}
