import React, { useState } from 'react';
import { ShoppingCart, ShieldCheck, Zap, Server, QrCode, CreditCard, CheckCircle, RefreshCw, Smartphone, DollarSign, Settings, Gamepad2, Copy, Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('store');
  const [selectedGame, setSelectedGame] = useState('royal');
  const [gameId, setGameId] = useState('');
  const [verifiedName, setVerifiedName] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [topupMode, setTopupMode] = useState('package');
  const [customAmount, setCustomAmount] = useState('');
  
  const packages = [
    { id: 1, chips: 160000, price: 20 },
    { id: 2, chips: 200000, price: 25 },
    { id: 3, chips: 240000, price: 30 },
    { id: 4, chips: 280000, price: 35 },
    { id: 5, chips: 320000, price: 40 },
    { id: 6, chips: 360000, price: 45 },
    { id: 7, chips: 400000, price: 50 },
    { id: 8, chips: 450000, price: 55 },
    { id: 9, chips: 520000, price: 60 },
    { id: 10, chips: 570000, price: 65 },
    { id: 11, chips: 610000, price: 70 },
    { id: 12, chips: 670000, price: 75 },
    { id: 13, chips: 720000, price: 80 },
    { id: 14, chips: 760000, price: 85 },
    { id: 15, chips: 810000, price: 90 },
    { id: 16, chips: 870000, price: 95 },
    { id: 17, chips: 920000, price: 100 },
    { id: 18, chips: 1000000, price: 110 },
  ];

  const [selectedPkg, setSelectedPkg] = useState(packages[0]);
  const [paymentMethod, setPaymentMethod] = useState('promptpay');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const calculatedCustomChips = customAmount ? Math.floor(Number(customAmount) * 8000) : 0;
  const currentPrice = topupMode === 'package' ? selectedPkg.price : Number(customAmount || 0);
  const currentChips = topupMode === 'package' ? selectedPkg.chips : calculatedCustomChips;

  const handleVerifyId = () => {
    if (!gameId || gameId.length < 5) {
      alert('กรุณากรอกไอดีเกมให้ถูกต้องก่อนตรวจสอบ');
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setVerifiedName(`VIP_Player_${gameId.slice(-4)}`);
      setIsVerifying(false);
    }, 800);
  };

  const handleCheckout = () => {
    if (!verifiedName) {
      alert('กรุณากรอกและตรวจสอบไอดีเกมก่อนทำรายการ');
      return;
    }
    if (topupMode === 'custom' && (!customAmount || Number(customAmount) <= 0)) {
      alert('กรุณาระบุจำนวนเงินที่ต้องการเติม');
      return;
    }
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setOrderSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <header className="bg-slate-900/80 backdrop-blur border-b border-amber-500/30 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-300 p-2 rounded-xl text-slate-950 font-black flex items-center shadow-lg shadow-amber-500/20">
              <Gamepad2 className="w-6 h-6 mr-1" />
              <span className="text-lg tracking-wider">BOSS STORE</span>
            </div>
            <span className="hidden sm:inline text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full">
              ⚡ ระบบอัตโนมัติ 24 ชม.
            </span>
          </div>
          <nav className="flex space-x-2">
            <button 
              onClick={() => { setActiveTab('store'); setOrderSuccess(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'store' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              หน้าร้าน
            </button>
            <button 
              onClick={() => setActiveTab('botGuide')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'botGuide' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              วิธีเชื่อมบอท
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {activeTab === 'store' && !orderSuccess && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-pink-950 via-slate-900 to-slate-900 border border-pink-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <h1 className="text-xl sm:text-2xl font-black text-pink-400 flex items-center">
                👑 ROYAL GAME VIP STORE
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                ปลอดภัย บริการไว ไว้ใจได้ 100% ลงทะเบียนไม่ใช้บัตร ทรูวอเล็ตและธนาคารเรทราคาเท่ากัน
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">1</span>
                เลือกเกมที่ต้องการเติม
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border-2 border-amber-500 bg-amber-500/10 rounded-xl p-4 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-600 to-purple-700 rounded-lg flex items-center justify-center font-black text-xl shadow">
                      R
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Royal Game</h3>
                      <p className="text-xs text-emerald-400">● สต็อกพร้อมโอน (ออโต้ 24 ชม.)</p>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-amber-500 bg-amber-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-950"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">2</span>
                กรอกไอดีเกมผู้รับ
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="ระบุ ID เกม Royal Game (เช่น 8839201)"
                  value={gameId}
                  onChange={(e) => { setGameId(e.target.value); setVerifiedName(null); }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-base"
                />
                <button 
                  onClick={handleVerifyId}
                  disabled={isVerifying}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold px-6 py-3 rounded-xl transition flex items-center justify-center shrink-0"
                >
                  {isVerifying ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'ตรวจสอบไอดี'}
                </button>
              </div>
              {verifiedName && (
                <div className="mt-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-center space-x-2 text-emerald-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>พบผู้เล่น: <strong className="text-white">{verifiedName}</strong> (พร้อมรับชิป)</span>
                </div>
              )}
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center">
                  <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">3</span>
                  เลือกจำนวนเงิน / แพ็กเกจตามป้าย
                </h2>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button 
                    onClick={() => setTopupMode('package')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${topupMode === 'package' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
                  >
                    ป้ายเรท 18 แพ็กเกจ
                  </button>
                  <button 
                    onClick={() => setTopupMode('custom')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${topupMode === 'custom' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
                  >
                    พิมพ์ยอดเงินเอง
                  </button>
                </div>
              </div>

              {topupMode === 'package' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {packages.map((pkg) => (
                    <div 
                      key={pkg.id}
                      onClick={() => setSelectedPkg(pkg)}
                      className={`border rounded-xl p-3 cursor-pointer transition text-center flex flex-col justify-between ${selectedPkg.id === pkg.id ? 'border-pink-500 bg-pink-500/10 shadow-md shadow-pink-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}
                    >
                      <div className="text-xs text-slate-300 font-medium">{pkg.chips.toLocaleString()} ชิป</div>
                      <div className="text-base font-black text-pink-400 mt-1">{pkg.price}฿</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="ระบุจำนวนเงินบาท (เช่น 50, 100)"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 text-lg font-bold"
                    />
                    <span className="absolute right-4 top-3 text-slate-400 font-bold">฿</span>
                  </div>
                  {customAmount > 0 && (
                    <div className="bg-pink-950/30 border border-pink-500/30 rounded-xl p-3 text-center">
                      <span className="text-xs text-slate-300">คุณจะได้รับชิปประมาณ:</span>
                      <div className="text-xl font-black text-pink-400">{calculatedCustomChips.toLocaleString()} ชิป</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">4</span>
                ช่องทางชำระเงิน (ระบบ Stripe อัตโนมัติ)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div 
                  onClick={() => setPaymentMethod('promptpay')}
                  className={`border-2 rounded-xl p-4 flex items-center space-x-3 cursor-pointer transition ${paymentMethod === 'promptpay' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/50'}`}
                >
                  <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">สแกน QR พร้อมเพย์</h3>
                    <p className="text-xs text-slate-400">รองรับทุกธนาคาร (Stripe)</p>
                  </div>
                </div>

                <div 
                  onClick={() => setPaymentMethod('truemoney')}
                  className={`border-2 rounded-xl p-4 flex items-center space-x-3 cursor-pointer transition ${paymentMethod === 'truemoney' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/50'}`}
                >
                  <div className="p-2.5 bg-orange-600/20 text-orange-400 rounded-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">ทรูมันนี่ วอเลท</h3>
                    <p className="text-xs text-slate-400">ชำระผ่าน TrueMoney (Stripe)</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400">ยอดชำระสุทธิ:</span>
                  <div className="text-2xl font-black text-amber-400">{currentPrice} บาท</div>
                  <span className="text-xs text-pink-400 font-medium">รับชิปจำนวน {currentChips.toLocaleString()} ชิป</span>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black px-8 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center text-base"
                >
                  {isCheckingOut ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2 fill-slate-950" />}
                  ชำระเงินผ่าน Stripe อัตโนมัติ
                </button>
              </div>
            </div>
          </div>
        )}

        {orderSuccess && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-center max-w-lg mx-auto shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40">
              <QrCode className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">สร้างรายการชำระเงินสำเร็จ</h2>
              <p className="text-sm text-slate-300 mt-1">กรุณาสแกน QR Code หรือชำระเงินผ่าน Stripe</p>
            </div>

            <div className="bg-white p-4 rounded-xl inline-block shadow-inner">
              <div className="w-48 h-48 bg-slate-900 rounded-lg flex flex-col items-center justify-center text-amber-400 p-2 text-center">
                <QrCode className="w-24 h-24 mb-2 text-amber-400" />
                <span className="text-xs text-white font-bold">Stripe PromptPay QR</span>
                <span className="text-xs text-slate-300">ยอด {currentPrice}.00 ฿</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">ไอดีเกมรับชิป:</span>
                <span className="text-white font-bold">{gameId} ({verifiedName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">จำนวนชิปที่จะได้รับ:</span>
                <span className="text-pink-400 font-bold">{currentChips.toLocaleString()} ชิป</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">สถานะบอท:</span>
                <span className="text-amber-400 font-bold animate-pulse">● รอการชำระเงินจาก Stripe Webhook...</span>
              </div>
            </div>

            <button 
              onClick={() => setOrderSuccess(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition"
            >
              กลับหน้าหลัก
            </button>
          </div>
        )}

        {activeTab === 'botGuide' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-black text-amber-400 flex items-center">
              <Server className="w-5 h-5 mr-2" /> คู่มือเชื่อมต่อบอท Python & Stripe Webhook
            </h2>
            <p className="text-sm text-slate-300">
              เมื่อลูกค้าชำระเงินผ่าน Stripe สำเร็จ ระบบจะยิง Webhook มาที่สคริปต์ Python ของคุณเพื่อสั่งให้บอทใน Emulator โอนชิปเข้าไอดีเกมของลูกค้าทันทีโดยอัตโนมัติ
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-sm font-bold text-white mb-2">1. โค้ดรับ Stripe Webhook & สั่งบอท ADB (`server.py`)</h3>
              <pre className="text-xs text-emerald-400 bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`import stripe
from flask import Flask, request, jsonify

app = Flask(__name__)
stripe.api_key = "sk_live_xxxxxx"

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    event = request.json
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        game_id = session['metadata']['game_id']
        chips = session['metadata']['chips']
        print(f"✅ ได้รับเงินแล้ว! กำลังโอนชิป {chips} ให้ไอดี {game_id}")
    return jsonify(status="success")

if __name__ == '__main__':
    app.run(port=5000)`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
