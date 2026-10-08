import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    host: true, // listen on your LAN so a phone on the same Wi-Fi can connect
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000, // Phaser itself is ~1.2 MB
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Pocket Quest',
        short_name: 'PocketQuest',
        description: 'A GBA-style top-down action adventure.',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#1a1424',
        theme_color: '#1a1424',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything (code, art, maps, data, audio) so the game works fully offline.
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,gif,json,tmj,tsj,mp3,ogg,wav,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // the service worker only runs in `npm run build` / `npm run preview`
      },
    }),
  ],
});
