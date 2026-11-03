import React, { useState } from 'react';
import { ShoppingBag, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';

export default function App() {
  const [gameId, setGameId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [chipsAmount, setChipsAmount] = useState(160000); // ตัวอย่างคำนวณชิปตามยอดเงิน
  const [loading, setLoading] = useState(false);

  // ฟังก์ชันคำนวณชิปคร่าวๆ ตามยอดเงิน (ปรับเปลี่ยนได้ตามต้องการ)
  const handleAmountChange = (e) => {
    const value = e.target.value;
    setCustomAmount(value);
    // ตัวอย่าง: 1 บาท = 8,000 ชิป
    setChipsAmount(value ? Number(value) * 8000 : 0);
  };

  // ฟังก์ชันกดส่งข้อมูลเพื่อสร้าง Stripe Checkout (PromptPay)
  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!gameId) {
      alert('กรุณากรอกไอดีเกมผู้รับชิป');
      return;
    }

    if (!customAmount || Number(customAmount) <= 0) {
      alert('กรุณาระบุจำนวนเงินบาทให้ถูกต้อง');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId,
          chips: chipsAmount,
          amount: Number(customAmount)
        })
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

        <form onSubmit={handleCheckout} className="space-y-5">
          {/* ช่องกรอกไอดีเกม */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              1. ไอดีผู้เล่น (Game ID)
            </label>
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="เช่น Player_123"
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
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full bg-[#1a243f] border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-white text-lg font-semibold focus:outline-none focus:border-purple-500 transition"
                required
                min="1"
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-bold">฿</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💎 จำนวนชิปที่จะได้รับ: <span className="text-pink-400 font-bold">{chipsAmount.toLocaleString()} ชิป</span>
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
