import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA + a single custom service worker (injectManifest) that hosts both
    // offline precaching and the FCM background message handler (src/sw.ts).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
      },
      manifest: {
        name: 'Field',
        short_name: 'Field',
        description: 'Live play-along football predictions — provably fair on Solana.',
        theme_color: '#091310',
        background_color: '#091310',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Enable the SW in dev too, so push can be tested with `npm run dev`.
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  server: { port: 5173, open: false },
  // Reown AppKit / WalletConnect expect a Node-style `global` at runtime.
  define: { global: 'globalThis' },
  build: { sourcemap: true },
});
