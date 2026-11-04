import React, { useState } from 'react';
import { ShoppingBag, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';

// ต้องตรงกับ api/create-checkout-session.js (server เป็นตัวตัดสินจริง ค่านี้ใช้แสดงผลเท่านั้น)
const CHIPS_PER_BAHT = 8000;
const MIN_BAHT = 19;
const MAX_BAHT = 50000;

export default function App() {
  const [gameId, setGameId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const paymentStatus = new URLSearchParams(window.location.search).get('payment');

  const baht = Number(customAmount);
  const chipsAmount = Number.isInteger(baht) && baht > 0 ? baht * CHIPS_PER_BAHT : 0;

  // ฟังก์ชันกดส่งข้อมูลเพื่อสร้าง Stripe Checkout (PromptPay)
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
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, amount: baht })
      });

      const data = await response.json();

      if (data.url) {
        // พาผู้ใช้งานพุ่งไปยังหน้าสแกน QR Code ของ Stripe
        window.location.href = data.url;
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data.error || 'ไม่สามารถสร้างรายการชำระเงินได้'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('ไม่สามารถเชื่อมต่อกับระบบชำระเงินได้');
      setLoading(false);
    }
  };

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

        {paymentStatus === 'success' && (
          <div className="mb-5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm rounded-xl px-4 py-3">
            ✅ ชำระเงินสำเร็จ ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)
          </div>
        )}
        {paymentStatus === 'cancel' && (
          <div className="mb-5 bg-gray-600/20 border border-gray-500/40 text-gray-300 text-sm rounded-xl px-4 py-3">
            ยกเลิกการชำระเงินแล้ว ยังไม่มีการเรียกเก็บเงิน
          </div>
        )}

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
                1 บาท = {CHIPS_PER_BAHT.toLocaleString()} เหรียญ · ขั้นต่ำ {MIN_BAHT} บาท
              </span>
            </p>
          </div>

          {/* ปุ่มกดชำระเงิน */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              'กำลังสร้างรายการ...'
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
