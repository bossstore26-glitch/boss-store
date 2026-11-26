import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Privacy from './Privacy.jsx'
import { moveDomain } from './moveDomain.js'

// /?privacy = หน้านโยบายความเป็นส่วนตัว (ลิงก์ที่ยื่น Meta) — เว็บเป็นหน้าเดียว ไม่มีระบบ path
const params = new URLSearchParams(window.location.search)
const Page = params.has('privacy') ? Privacy : App

// 26 พ.ย.: ลิงก์เดิม → พาไป www.bossstore.net พร้อมข้อมูลที่ลูกค้าจำไว้ (ต้องทำก่อนวาดหน้า)
if (!moveDomain()) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>,
  )
}
