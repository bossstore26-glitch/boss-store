import React, { useState } from 'react';
import { ShoppingCart, ShieldCheck, Zap, Server, QrCode, CreditCard, CheckCircle, RefreshCw, Smartphone, DollarSign, Settings, Gamepad2, Copy, Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('store'); // store, admin, botGuide
  const [selectedGame, setSelectedGame] = useState('royal');
  const [gameId, setGameId] = useState('');
  const [verifiedName, setVerifiedName] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // โหมดเติมเงิน: 'package' (เลือกตามป้าย) หรือ 'custom' (พิมพ์ยอดเอง)
  const [topupMode, setTopupMode] = useState('package');
  const [customAmount, setCustomAmount] = useState('');
  
  // แพ็กเกจเรทราคาตามป้ายร้าน BOSS STORE
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
  const [paymentMethod, setPaymentMethod] = useState('promptpay'); // promptpay, truemoney
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // คำนวณชิปกรณีพิมพ์ยอดเงินเอง (เรทเฉลี่ยประมาณ 8,000 ชิปต่อ 1 บาท)
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
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
            {/* Banner */}
            <div className="bg-gradient-to-r from-pink-950 via-slate-900 to-slate-900 border border-pink-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl"></div>
              <h1 className="text-xl sm:text-2xl font-black text-pink-400 flex items-center">
                👑 ROYAL GAME VIP STORE
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                ปลอดภัย บริการไว ไว้ใจได้ 100% ลงทะเบียนไม่ใช้บัตร ทรูวอเล็ตและธนาคารเรทราคาเท่ากัน
              </p>
            </div>

            {/* ขั้นที่ 1: เลือกเกม */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">1</span>
                เลือกเกมที่ต้องการเติม
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div 
                  onClick={() => setSelectedGame('royal')}
                  className={`border-2 rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${selectedGame === 'royal' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-600 to-purple-700 rounded-lg flex items-center justify-center font-black text-xl shadow">
                      R
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Royal Game</h3>
                      <p className="text-xs text-emerald-400">● สต็อกพร้อมโอน (ออโต้ 24 ชม.)</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedGame === 'royal' ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
                    {selectedGame === 'royal' && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                  </div>
                </div>
              </div>
            </div>

            {/* ขั้นที่ 2: กรองไอดีเกม */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-amber-500 text-slate-950 w-5 h-5 rounded-full inline-flex items-center justify-center text-xs mr-2 font-black">2</span>
                กรอกไอดีเกมผู้รับ
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="ระบุ ID เกม Royal Game (เช่น 8839201)"
                    value={gameId}
                    onChange={(e) => { setGameId(e.target.value); setVerifiedName(null); }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-base"
                  />
                </div>
                <button 
                  onClick={handleVerifyId}
                  disabled={isVerifying}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold px-6 py-3 rounded-xl transition flex items-center justify-center"
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

            {/* ขั้นที่ 3: เลือกแพ็กเกจ หรือ กรอกจำนวนเงิน */}
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
                      className={`border rounded-xl p-3 cursor-pointer transition text-center
