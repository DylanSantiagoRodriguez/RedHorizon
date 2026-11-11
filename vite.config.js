import { defineConfig } from 'vite';
const backend = `http://127.0.0.1:${Number(process.env.RH_BACKEND_PORT || 8787)}`;
export default defineConfig({
  server: { proxy: { '/ws': { target: backend, ws: true }, '/health': backend } },
  preview: { proxy: { '/ws': { target: backend, ws: true }, '/health': backend } },
  build: { rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } }, chunkSizeWarningLimit: 650 },
  test: { include: ['tests/**/*.test.js'] },
});
