import { test, expect } from '@playwright/test';

test('espera los modelos en la entrada y al reiniciar, sin mostrar los respaldos', async ({ page }) => {
  let release;
  let barrier = new Promise(resolve => { release = resolve; });
  await page.route('**/models/environment/world_*.glb', async route => { await barrier; await route.continue(); });
  await page.goto('/?qa');
  await expect(page.locator('.model-loading')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__RED_HORIZON__)).toBe(true);
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  release();
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
  barrier = new Promise(resolve => { release = resolve; });
  await page.locator('#start').click();
  await expect(page.locator('.model-loading')).toBeVisible();
  await page.keyboard.down('KeyD');
  const frozen = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, before = g.run.time;
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    return g.run.time === before && g.run.time === 0;
  });
  expect(frozen).toBe(true);
  await page.keyboard.up('KeyD'); release();
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    g.pause(); g.run.director.timer = 999;
    return !!(g.entities.avatar && g.world.environmentLoaded && g.world.wreck && g.missionView.beacon && g.missionView.helmetModel && g.missionView.aurora) &&
      !g.world.terrainMesh.visible && g.world.rockViews.every(r => !r.visible) && !g.world.wreckFallback.visible && !g.missionView.base.visible;
  })).toBe(true);
  let releaseEnemy;
  const enemyBarrier = new Promise(resolve => { releaseEnemy = resolve; });
  await page.route('**/models/stalker.glb', async route => { await enemyBarrier; await route.continue(); });
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__, e = g.run.spawn('stalker', 0, 0);
    g.entities.sync(g.run);
    const mesh = g.entities.enemies.get(e.id);
    for (let i = 0; i < 10; i++) g.entities.sync(g.run);
    return mesh.children.every(c => !c.visible);
  })).toBe(true);
  releaseEnemy();
  expect(await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, mesh = [...g.entities.enemies.values()].find(m => m.userData.stalkerReady);
    await mesh.userData.stalkerReady; g.entities.sync(g.run);
    const avatar = g.entities.stalkerAvatars.get(mesh);
    return !!avatar && mesh.children.every(c => c === avatar.root || !c.visible);
  })).toBe(true);
});

test('una descarga fallida permite entrar con el respaldo, sin bloquear la carga', async ({ page }) => {
  await page.route('**/models/beacon.glb', route => route.abort());
  await page.goto('/?qa');
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
  await page.locator('#start').click();
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 60000 });
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    return !g.loading.pending && !!g.entities.avatar && !g.missionView.beacon && g.missionView.base.visible;
  })).toBe(true);
});
