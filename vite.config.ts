import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  base: '/village-case/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      workbox: {
        // 빌드가 낸 모든 파일(html, js, 워커 청크, 스테이지 데이터, css, 아이콘)을 미리 저장
        globPatterns: ['**/*.{html,js,css,json,png,svg,webmanifest}'],
        navigateFallback: '/village-case/index.html',
      },
      manifest: {
        name: '마을 수사록',
        short_name: '마을 수사록',
        description: '진술을 모으고 거짓말을 가려내 숨은 악을 체포하는 추리 퍼즐',
        lang: 'ko',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f3ede1',
        background_color: '#f3ede1',
        start_url: '/village-case/',
        scope: '/village-case/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    root: 'src',
    // 로컬 PC 코어의 절반까지만 쓴다
    poolOptions: {
      threads: { maxThreads: 10, minThreads: 1 },
      forks: { maxForks: 10, minForks: 1 },
    },
  },
});
