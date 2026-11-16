import { test, expect } from '@playwright/test';
test('three worker cluster: browser rooms, shared play, and reload during coordinator outage', async ({ browser, request }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(c => c.newPage())); const [a, b, c] = pages;
  try {
    for (const p of pages) {
      await p.goto('/?qa');
      await p.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.save.write(); g.applyOptions(); });
      await p.getByRole('button', { name: 'Multijugador', exact: true }).click();
    }
    await a.getByRole('button', { name: 'Crear sala', exact: true }).click();
    await expect(a.locator('#lobby-code')).toHaveText(/^[A-Z2-9]{6}$/);
    const code = await a.locator('#lobby-code').textContent();
    await b.locator('#room-code').fill(code); await b.getByRole('button', { name: 'Unirse con código', exact: true }).click();
    await expect(a.locator('#lobby-players li')).toHaveCount(2);
    await c.getByRole('button', { name: 'Crear sala', exact: true }).click(); await expect(c.locator('#lobby-code')).toHaveText(/^[A-Z2-9]{6}$/);
    const identity = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('rh-online')));
    const ia = await identity(a), ib = await identity(b), ic = await identity(c);
    expect(ia.serverId).toBe(ib.serverId); expect(ic.serverId).not.toBe(ia.serverId);
    await a.getByRole('button', { name: 'Listo', exact: true }).click(); await b.getByRole('button', { name: 'Listo', exact: true }).click();
    await expect(a.locator('#start-room')).toBeEnabled(); await a.locator('#start-room').click();
    await expect.poll(() => b.evaluate(() => window.__RED_HORIZON__.online?.players.size)).toBe(2);
    const response = await request.post('http://127.0.0.1:18790/coordinator-off', { headers: { 'x-test-fixture': 'redhorizon-playwright' } }); expect(response.ok()).toBe(true);
    const before = await b.evaluate(() => window.__RED_HORIZON__.run.time);
    await expect.poll(() => b.evaluate(() => window.__RED_HORIZON__.run.time)).toBeGreaterThan(before);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => a.evaluate(() => window.__RED_HORIZON__?.online?.connected)).toBe(true);
    expect(await identity(a)).toEqual(ia);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
