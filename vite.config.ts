import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '안양 문화유산 탐험',
        short_name: '문화유산 탐험',
        description: '데이터 주도형 모바일 반응형 문화재 탐험 게임',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        // 설치(PWA) 실행 시 브라우저 UI를 최대한 숨겨 "앱처럼" 보이게 함
        // (브라우저/OS 정책에 따라 fullscreen이 무시될 수 있어 fallback도 함께 제공)
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui', 'browser'],
        // 설치(PWA) 실행 시 가로 화면을 우선 권장 (브라우저 정책에 따라 적용 여부는 다를 수 있음)
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
      },
      workbox: {
        // 기본 캐싱 정책. 필요 시 런타임 캐시 규칙을 더 추가 가능.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,mp3,json}'],
        // 에셋(BGM/이미지) 용량이 커서 기본(2MiB) 제한을 초과할 수 있음
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
  ],
});
