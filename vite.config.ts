import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '문화재 탐험',
        short_name: '문화재탐험',
        description: '데이터 주도형 모바일 반응형 문화재 탐험 게임',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        display: 'standalone',
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
