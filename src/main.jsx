import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initMonitor } from './lib/monitor.js'

// 클라이언트 진단 — 프로덕션에서만(개발/테스트에서는 no-op). JS 오류·환율 폴백 진단만,
// 개인/거래 데이터는 전송하지 않는다.
if (import.meta.env.PROD) {
  initMonitor({ version: __APP_VERSION__ })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: 오프라인 캐싱 + 푸시 수신 서비스워커 (dev에서는 HMR 간섭을 피해 미등록)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
