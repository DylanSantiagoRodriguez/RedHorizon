import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, expect } = require('@playwright/test');

const url = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (response.ok) { ready = true; break; }
  } catch { /* Preview may still be starting. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) throw new Error(`Site not ready: ${url}`);

const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [], loadedModels = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /No se pudo cargar el personaje/.test(message.text())) errors.push(message.text());
  });
  page.on('requestfailed', request => failed.push(`${request.url()}: ${request.failure().errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    if (response.ok() && response.url().endsWith('/models/player/player.glb')) loadedModels.push(response.url());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect.poll(() => loadedModels.length, { timeout: 30000 }).toBeGreaterThan(0);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await expect(page.locator('#resume')).toBeVisible();
  await page.locator('#resume').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/production-smoke.png' });
  expect(errors, 'Browser errors').toEqual([]);
  expect(failed, 'Failed assets').toEqual([]);
  console.log(JSON.stringify({ result: 'passed', url: page.url(), loadedModels, errors, failed }));
} finally {
  await browser.close();
}
