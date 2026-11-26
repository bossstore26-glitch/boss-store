// หน้านโยบายความเป็นส่วนตัว (ใช้ยื่น Meta App Review) เปิดที่ /?privacy
import React from 'react';

const UPDATED = '10 November 2026';

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <div className="text-slate-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-violet-400 text-sm">← BOSS STORE</a>
        <h1 className="text-2xl font-bold text-white mt-4">Privacy Policy · นโยบายความเป็นส่วนตัว</h1>
        <p className="text-slate-400 text-sm mt-1 mb-8">BOSS STORE · Last updated {UPDATED}</p>

        <Section title="1. Who we are">
          <p>BOSS STORE sells in-game coins for Royal Game and Siam through this website
            (boss-store-nine.vercel.app) and answers customers through our Facebook Page "BOSS STORE".</p>
          <p className="text-slate-400">BOSS STORE ขายเหรียญเกม Royal Game และ Siam ผ่านเว็บไซต์นี้ และตอบลูกค้าผ่านเพจ Facebook "BOSS STORE"</p>
        </Section>

        <Section title="2. Information we collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Orders:</b> game ID, game, amount, order code, time.</li>
            <li><b>Payment verification:</b> for PromptPay, the slip image you upload and the payer name, bank and
              partially masked account number shown on it; for TrueMoney, the payer name and phone number provided by TrueMoney.</li>
            <li><b>Facebook Messenger:</b> when you message our Page we receive your Page-scoped ID, your public
              name and the messages/images you send.</li>
            <li>Technical data such as IP address, used only to stop abuse (e.g. repeated fake slips).</li>
          </ul>
          <p className="text-slate-400">ข้อมูลที่เก็บ: ไอดีเกมและรายละเอียดออเดอร์, สลิป/ชื่อผู้โอน/ธนาคาร/เลขบัญชีบางส่วน (พร้อมเพย์), ชื่อและเบอร์ผู้จ่าย (TrueMoney), ข้อความที่ทักเพจ, IP address เพื่อป้องกันการโกง</p>
        </Section>

        <Section title="3. How we use it">
          <ul className="list-disc pl-5 space-y-1">
            <li>To verify payments and deliver coins to the correct game ID.</li>
            <li>To protect customers from fraud (for example, checking that a payer matches previous orders for the same game ID).</li>
            <li>To answer your Messenger questions about orders, including order status.</li>
            <li>To keep accounting and tax records required by Thai law.</li>
          </ul>
        </Section>

        <Section title="4. Automated replies on Messenger (AI)">
          <p>Messages sent to our Facebook Page may be answered by an automated assistant. To write a reply,
            the text of your message, recent conversation history and your order status are sent to our AI
            service provider. Phone numbers and bank account numbers are removed before sending.
            The assistant can only read order status; it cannot send coins, issue refunds or change any data.
            Questions it cannot answer are forwarded to a human admin.</p>
          <p className="text-slate-400">ข้อความที่ทักเพจอาจตอบโดยระบบอัตโนมัติ (AI) ข้อความและสถานะออเดอร์จะถูกส่งให้ผู้ให้บริการ AI โดยตัดเบอร์โทรและเลขบัญชีออกก่อน AI อ่านสถานะได้อย่างเดียว เรื่องที่ตอบไม่ได้จะส่งต่อให้แอดมิน</p>
        </Section>

        <Section title="5. Who we share it with">
          <ul className="list-disc pl-5 space-y-1">
            <li>Payment verification services (slip verification provider, TrueMoney) — to confirm payments.</li>
            <li>Our AI service provider — only to generate Messenger replies, as described above.</li>
            <li>Telegram — to notify our own admin about orders and messages that need attention.</li>
            <li>Government authorities when required by law.</li>
          </ul>
          <p>We do not sell your personal data and do not use it for advertising.</p>
        </Section>

        <Section title="6. How long we keep it">
          <ul className="list-disc pl-5 space-y-1">
            <li>Messenger conversation memory: only the latest 12 messages per customer.</li>
            <li>Order, payment and slip records: kept as accounting records for the period required by Thai law.</li>
          </ul>
        </Section>

        <Section title="7. Your rights and data deletion">
          <p id="delete">You may ask to see, correct or delete your personal data. To request deletion of your
            Messenger data, send the message <b>"ลบข้อมูล" (delete my data)</b> to our Facebook Page
            <b> BOSS STORE</b>. We will delete your conversation data within 30 days and confirm by message.
            Order and payment records that we must keep by law will be kept until the legal period ends.</p>
          <p className="text-slate-400">ขอดู แก้ไข หรือลบข้อมูลได้ โดยทักเพจ BOSS STORE พิมพ์ "ลบข้อมูล" ร้านจะลบข้อมูลแชตภายใน 30 วัน (ข้อมูลออเดอร์/การเงินที่กฎหมายกำหนดให้เก็บ จะเก็บไว้จนครบกำหนด)</p>
        </Section>

        <Section title="8. Contact">
          <p>Message our Facebook Page "BOSS STORE".</p>
        </Section>
      </div>
    </main>
  );
}
