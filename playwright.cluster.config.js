import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'cluster.spec.js', workers: 1, timeout: 180000, expect: { timeout: 20000 }, outputDir: 'test-results/cluster',
  use: { baseURL: 'http://127.0.0.1:5181', headless: true, channel: 'chromium', launchOptions: { args: ['--enable-webgl', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/browser/cluster-server.mjs', url: 'http://127.0.0.1:18789/health', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --port 5181 --strictPort', env: { RH_BACKEND_PORT: '18789' }, url: 'http://127.0.0.1:5181', reuseExistingServer: false },
  ],
});
