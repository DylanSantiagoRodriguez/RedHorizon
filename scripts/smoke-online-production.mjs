import { chromium, expect } from '@playwright/test';

// Uses the published UI and public WebSocket only; no QA globals or fixtures.
const url = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const health = await fetch(new URL('/health', url)).then(r => r.json());
if (!health.ok) throw new Error('Backend no disponible');
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader'] });
const errors = [], peers = [];
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => { localStorage.setItem('red-horizon-v1', JSON.stringify({ options: { quality: 'low', volume: 0 } })); });
    const page = await context.newPage(), peer = { page, context };
    peers.push(peer);
    page.on('pageerror', e => errors.push(e.message));
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      try {
        const m = JSON.parse(payload);
        // Never log or persist the welcome's reconnection token.
        if (m.type === 'welcome') peer.id = m.playerId;
        if (m.type === 'snapshot') peer.snapshot = m;
      } catch { /* Ignore non-JSON frames. */ }
    }));
  }
  const [a, b] = peers;
  await Promise.all(peers.map(p => p.page.goto(url, { waitUntil: 'domcontentloaded' })));
  for (const peer of peers) {
    await peer.page.getByRole('button', { name: 'Multijugador', exact: true }).click();
    await peer.page.locator('#online-name').fill(peer === a ? 'Verificación A' : 'Verificación B');
  }
  await a.page.locator('#create-room').click(); await expect(a.page.locator('#lobby-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await a.page.locator('#lobby-code').textContent();
  await b.page.locator('#room-code').fill(code); await b.page.locator('#join-room').click();
  await expect(a.page.locator('#lobby-players li')).toHaveCount(2);
  await a.page.locator('#ready-room').click(); await b.page.locator('#ready-room').click();
  await expect(a.page.locator('#start-room')).toBeEnabled(); await a.page.locator('#start-room').click();
  await expect.poll(() => b.snapshot?.players.length, { timeout: 15000 }).toBe(2);
  for (const peer of peers) await expect(peer.page.locator('.online-team [data-player-id]')).toHaveCount(2);
  const id = a.id, z = b.snapshot.players.find(p => p.id === id).z;
  await a.page.keyboard.down('KeyW');
  try { await expect.poll(() => b.snapshot.players.find(p => p.id === id).z, { timeout: 15000 }).toBeLessThan(z - 1); }
  finally { await a.page.keyboard.up('KeyW'); }
  await a.page.keyboard.press('Escape'); await expect(a.page.locator('#resume')).toBeVisible();
  const time = b.snapshot.time; await expect.poll(() => b.snapshot.time).toBeGreaterThan(time + .5);
  await a.page.locator('#resume').click(); await a.page.keyboard.press('KeyF');
  await expect.poll(() => b.snapshot.projectiles.some(p => p.ownerId === id), { timeout: 10000 }).toBe(true);
  await a.page.keyboard.press('KeyF');
  await expect.poll(() => a.snapshot.enemies.some(e => b.snapshot.enemies.some(other => other.id === e.id)), { timeout: 10000 }).toBe(true);
  await a.page.reload({ waitUntil: 'domcontentloaded' });
  await a.page.getByRole('button', { name: 'Multijugador', exact: true }).click();
  await expect(a.page.locator('.online-team [data-player-id]')).toHaveCount(2, { timeout: 15000 });
  expect(a.id).toBe(id); expect(b.snapshot.players).toHaveLength(2);
  expect(errors).toEqual([]);
  for (const peer of peers) {
    if (!await peer.page.locator('#menu').isVisible()) await peer.page.locator('#pause-button').click();
    await peer.page.locator('#menu').click();
  }
  console.log(JSON.stringify({ result: 'passed', url, buildId: health.buildId, checks: ['two browser contexts', 'lobby and ready', 'shared movement', 'shared enemies and projectiles', 'local Escape', 'identity after reload', 'leave'], errors }));
} finally { await browser.close(); }
