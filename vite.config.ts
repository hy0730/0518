import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        // 아래 파일들은 public/ 루트에 둘 것을 권장 (없어도 빌드는 되지만, 설치 아이콘이 깨질 수 있음)
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
      ],
      manifest: {
        name: '문화재 탐험',
        short_name: '문화재탐험',
        description: '데이터 주도형 모바일 반응형 문화재 탐험 게임',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 기본 캐싱 정책. 필요 시 런타임 캐시 규칙을 더 추가 가능.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,mp3,json}'],
      },
    }),
  ],
});

