import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
export default defineConfig({
  testDir: './tests/browser', testIgnore: 'online.spec.js', fullyParallel: false, workers: 1, timeout: 90000,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 900 }, headless: true, launchOptions: { args: ['--enable-webgl', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `npm run dev:frontend -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
