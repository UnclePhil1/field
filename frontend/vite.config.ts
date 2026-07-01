import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  // Reown AppKit / WalletConnect expect a Node-style `global` at runtime.
  define: { global: 'globalThis' },
  build: { sourcemap: true },
});
