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

  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  await page.route(/\/models\/(ruby|sapphire|emerald|amethyst|dust)\.glb$/, async route => { await barrier; await route.continue(); });
  try {
    expect(await page.evaluate(() => {
      const g = window.__RED_HORIZON__;
      for (const guardianId of ['ruby', 'sapphire', 'emerald', 'amethyst', 'dust']) {
        const enemy = g.run.spawn('titan', 0, -10); enemy.guardianId = guardianId;
      }
      for (let i = 0; i < 10; i++) g.entities.sync(g.run, 0);
      return [...g.entities.enemies.values()].every(mesh => mesh.children.length === 0);
    })).toBe(true);
  } finally { release(); }
  await expect.poll(() => page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    return [...g.entities.enemies.values()].filter(mesh => {
      const avatar = g.entities.animatedAvatar(mesh);
      return avatar && mesh.children.length === 1 && mesh.children[0] === avatar.root && avatar.root.visible;
    }).length;
  }), { timeout: 60000 }).toBe(5);
});
