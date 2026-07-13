import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxies /api and /verify to the lab-manager on :4000 so cookies are same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true, ws: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/verify': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
