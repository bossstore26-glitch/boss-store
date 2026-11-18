import React from "react";
// ระบบแปลภาษา 3 ภาษา: ไทย (th) · อังกฤษ (en) · ลาว (lo)
// ใช้: t('key') · เปลี่ยนภาษา: setLang('en') → บันทึก + รีโหลดหน้า
export const LANGS = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'EN' },
  { code: 'lo', label: 'ລາວ' },
];

const DICT = {
  th: {
    h24: '24 ชม.',
    h1a: 'เติมเหรียญ', h1b: 'เข้าไอดีในเกม',
    scam: 'ไอดีเกมไม่ใช่ของคุณ ห้ามจ่าย = มิจฉาชีพ',
    sub: 'เลือกเกม กรอกไอดี จ่ายผ่านพร้อมเพย์หรือทรูมันนี่ รับเหรียญใน 2 นาที',
    game: 'เกม', id: 'ไอดี', check: 'ตรวจ', amount: 'ยอดเงิน', baht: 'บาท', coins: 'เหรียญ',
    method: 'ช่องทางจ่าย', pp: 'พร้อมเพย์', tmn: 'TrueMoney',
    ppSub: 'สแกน QR แอปธนาคาร แล้วอัปโหลดสลิป', tmnSub: 'เปิดแอปจ่ายในคลิกเดียว',
    pay: 'ชำระเงิน', selected: 'เลือกอยู่', closedNow: 'ปิดชั่วคราว', startFrom: 'เริ่ม', 
    confirmTitle: 'ตรวจไอดีให้ถูกก่อนจ่าย',
    confirmWarn: 'ถ้าไอดีผิด เหรียญจะถูกส่งไปไอดีอื่นและเรียกคืนไม่ได้',
    found: 'เจอไอดีนี้ในเกม — ใช่ตัวละครของคุณไหม?',
    foundHint: 'ถ้าไม่ใช่ชื่อตัวละครของคุณ กด "แก้ไขไอดี"',
    notFound: 'ไม่พบไอดีนี้ในเกม',
    notFoundHint: 'ตัวเลขอาจขาด เกิน หรือสลับกัน กด "แก้ไขไอดี" แล้วคัดลอกไอดีจากหน้าโปรไฟล์ในเกมมาวางอีกครั้ง',
    edit: 'แก้ไขไอดี', cont: 'ดำเนินการต่อ', contFound: 'ใช่ ตัวละครนี้ ดำเนินการต่อ', sureCont: 'ฉันมั่นใจว่าไอดีถูกต้อง ดำเนินการต่อ',
    bankLabel: 'เลขบัญชีธนาคารที่จะใช้โอน', digit10: '(10 หลัก)',
    bankHint: 'ดูเลขบัญชีในแอปธนาคาร (ห้ามใส่เบอร์มือถือ)',
    bankErr: 'ต้องกรอกเลขบัญชีธนาคาร 10 หลัก (เว้นว่างไม่ได้)',
    bankOwn: '⚠️ ต้องเป็นบัญชีชื่อคุณเองเท่านั้น ห้ามให้คนอื่นโอนแทน',
    bankPhone: 'เลขนี้เหมือนเบอร์มือถือ — กรุณาใส่เลขบัญชีธนาคาร (ดูในแอปธนาคาร)',
    bankPick: 'ธนาคารที่จะใช้โอน', bankOther: 'อื่นๆ', bankPickErr: 'กรุณาเลือกธนาคารที่จะใช้โอน',
    digit12: '(12 หลัก)', digitAny: '(10–15 หลัก)',
    bankErr12: 'ต้องกรอกเลขบัญชี 12 หลัก (ออมสิน/ธ.ก.ส.)', bankErrAny: 'ต้องกรอกเลขบัญชี 10–15 หลัก',
    checking: 'กำลังค้นหาไอดี...', amtLabel: 'จำนวนเงิน', recentIds: 'ไอดีที่ใช้ล่าสุด',
  },
  en: {
    h24: '24 hrs',
    h1a: 'Top up coins', h1b: 'to your game ID',
    scam: "If the game ID isn't yours, don't pay — it's a scam",
    sub: 'Pick a game, enter your ID, pay via PromptPay or TrueMoney. Coins arrive within 2 minutes.',
    game: 'Game', id: 'Game ID', check: 'Check', amount: 'Amount', baht: 'THB', coins: 'coins',
    method: 'Payment method', pp: 'PromptPay', tmn: 'TrueMoney',
    ppSub: 'Scan the QR in your banking app, then upload the slip', tmnSub: 'Pay in one tap in the app',
    pay: 'Pay', selected: 'Selected', closedNow: 'Paused', startFrom: 'From',
    confirmTitle: 'Check your ID before paying',
    confirmWarn: "If the ID is wrong, coins go to someone else and can't be recovered.",
    found: 'Found this ID in game — is this your character?',
    foundHint: 'If the character is not yours, tap “Edit ID”.',
    notFound: 'This ID was not found in game',
    notFoundHint: 'Digits may be missing, extra, or swapped. Tap “Edit ID” and copy the ID from your in-game profile again.',
    edit: 'Edit ID', cont: 'Continue', contFound: 'Yes, that is my character — continue', sureCont: "I'm sure the ID is correct — continue",
    bankLabel: 'Bank account number you will pay from', digit10: '(10 digits)',
    bankHint: 'Find it in your banking app (not your mobile number)',
    bankErr: 'Please enter your 10-digit bank account number (required)',
    bankOwn: '⚠️ Must be an account in your own name — no one else may pay for you',
    bankPhone: 'This looks like a mobile number — please enter your bank account number',
    bankPick: 'Bank you will pay from', bankOther: 'Other', bankPickErr: 'Please choose your bank',
    digit12: '(12 digits)', digitAny: '(10–15 digits)',
    bankErr12: 'Please enter your 12-digit account number (GSB/BAAC)', bankErrAny: 'Please enter a 10–15 digit account number',
    checking: 'Looking up this ID...', amtLabel: 'Amount', recentIds: 'Recently used IDs',
  },
  lo: {
    h24: '24 ຊມ',
    h1a: 'ເຕີມຫຼຽນ', h1b: 'ເຂົ້າໄອດີໃນເກມ',
    scam: 'ຖ້າໄອດີເກມບໍ່ແມ່ນຂອງທ່ານ ຫ້າມຈ່າຍ = ມິດສະພາ',
    sub: 'ເລືອກເກມ ໃສ່ໄອດີ ຈ່າຍຜ່ານ PromptPay ຫຼື TrueMoney ຮັບຫຼຽນພາຍໃນ 2 ນາທີ',
    game: 'ເກມ', id: 'ໄອດີ', check: 'ກວດ', amount: 'ຈຳນວນເງິນ', baht: 'ບາດ', coins: 'ຫຼຽນ',
    method: 'ຊ່ອງທາງຈ່າຍ', pp: 'PromptPay', tmn: 'TrueMoney',
    ppSub: 'ສະແກນ QR ໃນແອັບທະນາຄານ ແລ້ວອັບໂຫຼດສະລິບ', tmnSub: 'ເປີດແອັບຈ່າຍໃນຄຼິກດຽວ',
    pay: 'ຈ່າຍເງິນ', selected: 'ເລືອກແລ້ວ', closedNow: 'ປິດຊົ່ວຄາວ', startFrom: 'ເລີ່ມ',
    confirmTitle: 'ກວດໄອດີໃຫ້ຖືກກ່ອນຈ່າຍ',
    confirmWarn: 'ຖ້າໄອດີຜິດ ຫຼຽນຈະຖືກສົ່ງໄປໄອດີອື່ນ ແລະ ເອົາຄືນບໍ່ໄດ້',
    found: 'ພົບໄອດີນີ້ໃນເກມ — ແມ່ນຕົວລະຄອນຂອງທ່ານບໍ?',
    foundHint: 'ຖ້າບໍ່ແມ່ນຊື່ຕົວລະຄອນຂອງທ່ານ ກົດ “ແກ້ໄຂໄອດີ”',
    notFound: 'ບໍ່ພົບໄອດີນີ້ໃນເກມ',
    notFoundHint: 'ຕົວເລກອາດຂາດ ເກີນ ຫຼື ສະຫຼັບກັນ ກົດ “ແກ້ໄຂໄອດີ” ແລ້ວຄັດລອກໄອດີຈາກໜ້າໂປຣໄຟລ໌ໃນເກມມາວາງອີກ',
    edit: 'ແກ້ໄຂໄອດີ', cont: 'ດຳເນີນການຕໍ່', contFound: 'ແມ່ນ ຕົວລະຄອນນີ້ ດຳເນີນການຕໍ່', sureCont: 'ຂ້ອຍແນ່ໃຈວ່າໄອດີຖືກ ດຳເນີນການຕໍ່',
    bankLabel: 'ເລກບັນຊີທະນາຄານທີ່ຈະໃຊ້ໂອນ', digit10: '(10 ຫຼັກ)',
    bankHint: 'ເບິ່ງເລກບັນຊີໃນແອັບທະນາຄານ (ຫ້າມໃສ່ເບີມືຖື)',
    bankErr: 'ຕ້ອງກອກເລກບັນຊີທະນາຄານ 10 ຫຼັກ (ຫວ່າງບໍ່ໄດ້)',
    bankOwn: '⚠️ ຕ້ອງເປັນບັນຊີຊື່ຂອງທ່ານເອງເທົ່ານັ້ນ ຫ້າມໃຫ້ຄົນອື່ນໂອນແທນ',
    bankPhone: 'ເລກນີ້ຄືເບີມືຖື — ກະລຸນາໃສ່ເລກບັນຊີທະນາຄານ',
    bankPick: 'ທະນາຄານທີ່ຈະໃຊ້ໂອນ', bankOther: 'ອື່ນໆ', bankPickErr: 'ກະລຸນາເລືອກທະນາຄານ',
    digit12: '(12 ຫຼັກ)', digitAny: '(10–15 ຫຼັກ)',
    bankErr12: 'ຕ້ອງກອກເລກບັນຊີ 12 ຫຼັກ', bankErrAny: 'ຕ້ອງກອກເລກບັນຊີ 10–15 ຫຼັກ',
    checking: 'ກຳລັງຄົ້ນຫາໄອດີ...', amtLabel: 'ຈຳນວນເງິນ', recentIds: 'ໄອດີທີ່ໃຊ້ລ່າສຸດ',
  },
};

let LANG = 'th';
try {
  const saved = localStorage.getItem('bossstore_lang');
  if (saved && DICT[saved]) LANG = saved;
} catch { /* เพิกเฉย */ }

export function setLang(code) {
  try { localStorage.setItem('bossstore_lang', code); } catch { /* เพิกเฉย */ }
  window.location.reload();
}

export function currentLang() { return LANG; }

export function t(key) {
  return (DICT[LANG] && DICT[LANG][key]) || DICT.th[key] || key;
}

const FLAG = {
  th: (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#A51931" />
      <rect y="2" width="18" height="8" fill="#F4F5F8" />
      <rect y="4" width="18" height="4" fill="#2D2A4A" />
    </svg>
  ),
  en: (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#012169" />
      <path d="M0 0 18 12M18 0 0 12" stroke="#fff" strokeWidth="2" />
      <path d="M9 0v12M0 6h18" stroke="#fff" strokeWidth="3.2" />
      <path d="M9 0v12M0 6h18" stroke="#C8102E" strokeWidth="1.6" />
    </svg>
  ),
  lo: (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#CE1126" />
      <rect y="3" width="18" height="6" fill="#002868" />
      <circle cx="9" cy="6" r="2.6" fill="#fff" />
    </svg>
  ),
};
const FULL_NAME = { th: 'ไทย', en: 'English', lo: 'ລາວ' };

export function LangSwitch() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const cur = LANGS.find((l) => l.code === LANG) || LANGS[0];
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="เปลี่ยนภาษา"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px',
          background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999,
          color: 'var(--ink)', cursor: 'pointer', font: '700 11.5px/1 Prompt,sans-serif',
        }}
      >
        <span style={{ display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>{FLAG[cur.code]}</span>
        <span style={{ color: 'var(--muted)', fontSize: 9, marginTop: 1 }}>▼</span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, minWidth: 148,
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
            boxShadow: '0 12px 30px rgba(0,0,0,.35)', padding: 6,
          }}
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === LANG}
              onClick={() => { setOpen(false); if (l.code !== LANG) setLang(l.code); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                background: l.code === LANG ? 'var(--card2)' : 'transparent', border: 0,
                borderRadius: 10, padding: '9px 10px', cursor: 'pointer',
                color: 'var(--ink)', font: '600 13px/1 Prompt,sans-serif',
              }}
            >
              <span style={{ display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>{FLAG[l.code]}</span>
              <span style={{ flex: 1 }}>{FULL_NAME[l.code]}</span>
              {l.code === LANG && <span style={{ color: 'var(--gold, #e7b14a)', fontSize: 13 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- หน้าจ่ายเงิน / อัปสลิป (เฟส 2) ----------
Object.assign(DICT.th, {
  payAmount: 'ยอดที่ต้องโอน', mustMatch: 'ต้องตรงตามนี้', bahtUnit: 'บาท',
  qrExpiresIn: 'นาทีก่อน QR หมดอายุ', saveQr: 'บันทึกภาพ QR',
  qrExpiredTitle: 'QR หมดอายุแล้ว (ใช้ได้ 10 นาที)',
  qrExpiredHint: 'ยังไม่ได้โอน → สร้าง QR ใหม่ · โอนไปแล้ว → อัปโหลดสลิปด้านล่าง',
  newQr: 'สร้าง QR ใหม่', sendingCoins: 'ตรวจสลิปผ่าน ระบบกำลังส่งเหรียญเข้าไอดีของคุณ (ปกติไม่เกิน 2–3 นาที)',
  firstVerify: 'ได้รับเงินแล้ว เติมครั้งแรกต้องยืนยันตัวตน', chatShop: 'กรุณาทักข้อความแชทที่ร้าน',
  noReupload: 'ไม่ต้องอัปโหลดซ้ำ หน้านี้จะเปลี่ยนเองเมื่อส่งเหรียญ',
  waitBank: 'ได้รับสลิปแล้ว กำลังรอธนาคารยืนยันรายการ (ปกติ 1–10 นาที)',
  paidReview: 'ได้รับเงินแล้ว ร้านกำลังตรวจสอบไอดีก่อนส่งเหรียญ',
  step1a: 'กดปุ่ม "คัดลอก" ข้อความด้านล่างไว้ก่อน', step1b: 'ต้องบันทึกในสลิป เพื่อให้ระบบส่งเหรียญอัตโนมัติ',
  step2: 'กด "บันทึก QR" แล้วสแกนโอน', memoHint: 'อย่าลืมวางข้อความในช่อง', memoName: '"บันทึกช่วยจำ"',
  step3: 'โอนเสร็จแล้ว กดปุ่ม "อัปโหลดสลิป" ด้านล่าง', step3b: 'รับเหรียญอัตโนมัติทันที',
  upload: 'อัปโหลดสลิป', checkingSlip: 'กำลังตรวจสลิปกับธนาคาร...',
  uploadHint: 'สลิปปลอม สลิปซ้ำ หรือยอดไม่ตรง ระบบจะไม่ส่งเหรียญ',
  uploadHint2: 'อัปโหลดได้ภายใน 24 ชม. (ปิดหน้านี้แล้วกลับมาใหม่ได้)',
  addMore: 'เติมเพิ่ม', cancelEdit: 'ยกเลิก / แก้ไขยอด', helpCode: 'ติดปัญหาเรื่องเหรียญ แจ้งเพจพร้อมรหัสด้านบน',
});
Object.assign(DICT.en, {
  payAmount: 'Amount to transfer', mustMatch: 'must match exactly', bahtUnit: 'THB',
  qrExpiresIn: 'min until the QR expires', saveQr: 'Save QR image',
  qrExpiredTitle: 'QR expired (valid 10 minutes)',
  qrExpiredHint: 'Not paid yet → create a new QR · Already paid → upload your slip below',
  newQr: 'Create new QR', sendingCoins: 'Slip verified. Coins are being sent to your ID (usually 2–3 minutes).',
  firstVerify: 'Payment received. First top-up requires verification.', chatShop: 'Please message our shop chat',
  noReupload: 'No need to upload again. This page updates itself when coins are sent.',
  waitBank: 'Slip received. Waiting for the bank to confirm (usually 1–10 minutes).',
  paidReview: 'Payment received. The shop is checking your ID before sending coins.',
  step1a: 'Tap “Copy” to copy the note below', step1b: 'It must be in the slip so coins are sent automatically',
  step2: 'Tap “Save QR”, then scan and transfer', memoHint: 'Do not forget to paste it in the', memoName: '“Note/Memo” field',
  step3: 'After transfer, tap “Upload slip” below', step3b: 'to get coins automatically',
  upload: 'Upload slip', checkingSlip: 'Checking slip with the bank...',
  uploadHint: 'Fake, duplicate, or mismatched slips are rejected',
  uploadHint2: 'You can upload within 24 hours (you may close and come back)',
  addMore: 'Top up again', cancelEdit: 'Cancel / edit amount', helpCode: 'Problem with coins? Message us with the code above',
});
Object.assign(DICT.lo, {
  payAmount: 'ຈຳນວນທີ່ຕ້ອງໂອນ', mustMatch: 'ຕ້ອງຕົງຕາມນີ້', bahtUnit: 'ບາດ',
  qrExpiresIn: 'ນາທີກ່ອນ QR ໝົດອາຍຸ', saveQr: 'ບັນທຶກຮູບ QR',
  qrExpiredTitle: 'QR ໝົດອາຍຸແລ້ວ (ໃຊ້ໄດ້ 10 ນາທີ)',
  qrExpiredHint: 'ຍັງບໍ່ໄດ້ໂອນ → ສ້າງ QR ໃໝ່ · ໂອນແລ້ວ → ອັບໂຫຼດສະລິບລຸ່ມນີ້',
  newQr: 'ສ້າງ QR ໃໝ່', sendingCoins: 'ກວດສະລິບຜ່ານ ລະບົບກຳລັງສົ່ງຫຼຽນເຂົ້າໄອດີຂອງທ່ານ (ປົກກະຕິບໍ່ເກີນ 2–3 ນາທີ)',
  firstVerify: 'ໄດ້ຮັບເງິນແລ້ວ ການເຕີມຄັ້ງທຳອິດຕ້ອງຢືນຢັນຕົວຕົນ', chatShop: 'ກະລຸນາທັກຂໍ້ຄວາມແຊັດທີ່ຮ້ານ',
  noReupload: 'ບໍ່ຕ້ອງອັບໂຫຼດຊ້ຳ ໜ້ານີ້ຈະປ່ຽນເອງເມື່ອສົ່ງຫຼຽນ',
  waitBank: 'ໄດ້ຮັບສະລິບແລ້ວ ກຳລັງລໍຖ້າທະນາຄານຢືນຢັນ (ປົກກະຕິ 1–10 ນາທີ)',
  paidReview: 'ໄດ້ຮັບເງິນແລ້ວ ຮ້ານກຳລັງກວດໄອດີກ່ອນສົ່ງຫຼຽນ',
  step1a: 'ກົດປຸ່ມ "ຄັດລອກ" ຂໍ້ຄວາມລຸ່ມນີ້ກ່ອນ', step1b: 'ຕ້ອງບັນທຶກໃນສະລິບ ເພື່ອໃຫ້ລະບົບສົ່ງຫຼຽນອັດຕະໂນມັດ',
  step2: 'ກົດ "ບັນທຶກ QR" ແລ້ວສະແກນໂອນ', memoHint: 'ຢ່າລືມວາງຂໍ້ຄວາມໃນຊ່ອງ', memoName: '"ບັນທຶກຊ່ວຍຈຳ"',
  step3: 'ໂອນສຳເລັດແລ້ວ ກົດປຸ່ມ "ອັບໂຫຼດສະລິບ" ລຸ່ມນີ້', step3b: 'ຮັບຫຼຽນອັດຕະໂນມັດທັນທີ',
  upload: 'ອັບໂຫຼດສະລິບ', checkingSlip: 'ກຳລັງກວດສະລິບກັບທະນາຄານ...',
  uploadHint: 'ສະລິບປອມ ສະລິບຊ້ຳ ຫຼື ຍອດບໍ່ຕົງ ລະບົບຈະບໍ່ສົ່ງຫຼຽນ',
  uploadHint2: 'ອັບໂຫຼດໄດ້ພາຍໃນ 24 ຊມ (ປິດໜ້ານີ້ແລ້ວກັບມາໃໝ່ໄດ້)',
  addMore: 'ເຕີມເພີ່ມ', cancelEdit: 'ຍົກເລີກ / ແກ້ໄຂຍອດ', helpCode: 'ມີບັນຫາຫຼຽນ ແຈ້ງເພຈພ້ອມລະຫັດຂ້າງເທິງ',
});
Object.assign(DICT.th, { bankPickPlaceholder: 'เลือกธนาคารที่จะใช้โอน' });
Object.assign(DICT.en, { bankPickPlaceholder: 'Select your bank' });
Object.assign(DICT.lo, { bankPickPlaceholder: 'ເລືອກທະນາຄານທີ່ຈະໃຊ້ໂອນ' });
