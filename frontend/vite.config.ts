import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Field frontend — runs standalone on mock data.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: { sourcemap: true },
});
