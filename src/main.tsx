import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// PWA(Service Worker) 업데이트가 반영되지 않아 "구버전 화면"이 계속 보이는 문제를 줄이기 위해
// 자동 업데이트 체크 + 필요 시 즉시 새로고침을 트리거합니다.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.location.reload();
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
