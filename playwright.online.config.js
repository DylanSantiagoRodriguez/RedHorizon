import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'online.spec.js', workers: 1, timeout: 180000, expect: { timeout: 15000 }, outputDir: 'test-results/online',
  use: { baseURL: 'http://127.0.0.1:5179', viewport: { width: 1280, height: 800 }, headless: true, launchOptions: { args: ['--enable-webgl', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/browser/online-server.mjs', url: 'http://127.0.0.1:18787/health', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --port 5179 --strictPort', env: { RH_BACKEND_PORT: '18787' }, url: 'http://127.0.0.1:5179', reuseExistingServer: false },
  ],
});
