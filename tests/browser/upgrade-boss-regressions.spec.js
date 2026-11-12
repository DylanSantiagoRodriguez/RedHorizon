import { test, expect } from '@playwright/test';

test.use({ channel: 'chromium', viewport: { width: 640, height: 480 } });
test('recaptura el mouse al elegir y muestra solo los GLB de los cinco jefes', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('red-horizon-v1', JSON.stringify({ options: { quality: 'low', volume: 0 } })));
  await page.goto('/?qa');
  await page.locator('#start').click();
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
  await page.locator('canvas[data-engine]').click({ position: { x: 320, y: 240 } });
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    g.run.director.timer = 100000; g.run.enemies.length = 0;
    g.run.experience.pending = 1; g.run.checkLevel(); g.change('upgrade');
  });
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.locator('[data-upgrade]').first().click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === window.__RED_HORIZON__.input.canvas)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#resume')).toBeVisible();

  // Models must already be resident when an altar spawns its guardian.
  let downloads = 0;
  page.on('request', request => { if (/\/models\/(ruby|sapphire|emerald|amethyst|dust)\.glb$/.test(request.url())) downloads++; });
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    for (const guardianId of ['ruby', 'sapphire', 'emerald', 'amethyst', 'dust']) {
      const enemy = g.run.spawn('titan', 0, -10); enemy.guardianId = guardianId;
    }
    g.entities.sync(g.run, 0);
    return [...g.entities.enemies.values()].filter(mesh => {
      const avatar = g.entities.animatedAvatar(mesh);
      return avatar && mesh.children.length === 1 && mesh.children[0] === avatar.root && avatar.root.visible;
    }).length;
  })).toBe(5);
  expect(downloads).toBe(0);
});

test('una descarga fallida bloquea la entrada y permite reintentar', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('red-horizon-v1', JSON.stringify({ options: { quality: 'low', volume: 0 } })));
  await page.route('**/models/dust.glb', route => route.abort());
  await page.goto('/?qa');
  await expect(page.locator('.model-loading')).toContainText('No se pudieron cargar los guardianes');
  expect(await page.evaluate(() => window.__RED_HORIZON__.loading.pending)).toBe(true);
  await page.unroute('**/models/dust.glb');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
});
