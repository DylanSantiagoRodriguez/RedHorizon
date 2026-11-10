import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } }, chunkSizeWarningLimit: 650 },
  test: { include: ['tests/**/*.test.js'] },
});
