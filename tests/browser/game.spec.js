import { test, expect } from '@playwright/test';
const consoleErrors = new WeakMap();
test.beforeEach(async ({ page }) => { const errors = []; consoleErrors.set(page, errors); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(async ({ page }) => { expect(consoleErrors.get(page), 'Sin errores de consola/WebGL').toEqual([]); });
test('carga, movimiento, pausa, daño y reinicio', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?qa'); await expect(page.locator('#start')).toBeVisible();
  await page.locator('#seed').fill('QA-SURFACE');
  await page.screenshot({ path: 'docs/screenshots/menu.png' });
  await page.locator('#start').click(); await expect(page.locator('#hud')).toBeVisible();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.player.z)).toBeLessThan(-1);
  await page.evaluate(() => { window.jumpObserved = false; const start = performance.now(); function watch() { if (!window.__RED_HORIZON__.run.player.grounded) window.jumpObserved = true; if (performance.now() - start < 4000) requestAnimationFrame(watch); } requestAnimationFrame(watch); });
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.jumpObserved)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('#resume')).toBeVisible();
  const before = await page.evaluate(() => window.__RED_HORIZON__.run.time); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.time)).toBe(before);
  await page.locator('#resume').click(); await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.player.grounded)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/gameplay.png' });
  await page.evaluate(() => window.__RED_HORIZON__.run.hurtPlayer(10000));
  await expect(page.getByRole('heading', { name: 'Señal perdida' })).toBeVisible();
  await page.locator('#restart').click();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.player.hp)).toBe(120);
  expect(errors).toEqual([]);
});
test('opciones, controles y persistencia local', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#options').click();
  await page.locator('#quality').selectOption('low'); await page.locator('#assist').check();
  await page.locator('#back').click(); await page.locator('#controls').click();
  await expect(page.getByText('Pulso: daño, aturdimiento y escudo', { exact: true })).toBeVisible();
  await page.locator('#back').click(); await page.reload();
  await page.locator('#options').click(); await expect(page.locator('#quality')).toHaveValue('low'); await expect(page.locator('#assist')).toBeChecked();
});
test('combate real con arma, experiencia, selección y habilidad', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?qa'); await page.locator('#seed').fill('QA-COMBAT'); await page.locator('#start').click();
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__; g.run.director.timer = 999;
    const e = g.run.spawn('brute', 0, -8); e.hp = 20; e.speed = 0; e.xp = 32; e.range = 0;
    g.camera.yaw = Math.atan2(-0.95, 8); g.camera.pitch = Math.atan2(1.9 - e.y, 8); g.camera.ready = false;
  });
  await page.keyboard.press('KeyF');
  await expect(page.locator('.upgrade-card')).toHaveCount(3, { timeout: 15000 });
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.kills)).toBe(1);
  const frozen = await page.evaluate(() => window.__RED_HORIZON__.run.time); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.time)).toBe(frozen);
  await page.screenshot({ path: 'docs/screenshots/upgrades.png' });
  await page.locator('.upgrade-card').first().click(); await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => Object.values(window.__RED_HORIZON__.run.upgrades.stacks).reduce((a, b) => a + b, 0))).toBe(1);
  await page.keyboard.press('Digit2'); await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.weapon.equipped)).toBe('scatter');
  await page.keyboard.press('Digit3'); await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.weapon.equipped)).toBe('nova');
  await page.keyboard.press('KeyQ'); await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.ability.timer)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test('relés, aparición del jefe, fase II y victoria por proyectiles', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?qa'); await page.locator('#seed').fill('QA-TITAN'); await page.locator('#start').click();
  await page.evaluate(() => { window.__RED_HORIZON__.run.director.timer = 999; });
  for (let index = 0; index < 3; index++) {
    await page.evaluate(i => { const g = window.__RED_HORIZON__, b = g.world.beacons[i]; g.run.player.x = b.x; g.run.player.z = b.z; }, index);
    await expect(page.locator('#interaction')).toBeVisible(); await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.relays)).toBe(index + 1);
    if (await page.evaluate(() => window.__RED_HORIZON__.run.status === 'upgrade')) await page.locator('.upgrade-card').first().click();
  }
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.boss.spawned)).toBe(true);
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run, b = r.boss.enemy;
    r.player.x = 0; r.player.z = 0; r.player.y = g.world.heightAt(0, 0);
    b.x = 0; b.z = -8; b.y = g.world.heightAt(0, -8) + b.height; b.maxHp = 200; b.hp = 90; b.speed = 0; b.range = 0; b.abilityTimer = 0.05;
    r.weapon.equipped = 'scatter'; g.camera.pitch = Math.atan2(1.9 - b.y, 8); g.camera.yaw = Math.atan2(-0.95, 8); g.camera.ready = false;
  });
  await expect(page.locator('#boss-phase')).toContainText('II'); await expect(page.locator('#boss-bar')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/titan.png' });
  await page.keyboard.press('KeyF');
  await expect(page.getByRole('heading', { name: 'Horizonte recuperado' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'docs/screenshots/victory.png' });
  expect(await page.evaluate(() => window.__RED_HORIZON__.save.data.wins)).toBe(1);
  await page.locator('#restart').click(); await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.boss.spawned)).toBe(false);
  expect(errors).toEqual([]);
});
test('colisiones físicas, cámara y reinicios sin acumulación de geometrías', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#seed').fill('QA-COLLISION'); await page.locator('#start').click();
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run;
    r.director.timer = 999;
    const rock = [...g.world.terrain.rocks].sort((a, b) => b.height - a.height)[0]; window.qaRock = rock;
    r.player.x = rock.x; r.player.z = rock.z - rock.radius - 0.8; r.player.y = g.world.heightAt(r.player.x, r.player.z);
    g.camera.yaw = 0; g.camera.pitch = 0; g.camera.ready = false;
  });
  await expect.poll(() => page.evaluate(() => { const g = window.__RED_HORIZON__; return g.view.camera.position.distanceTo(g.camera.target); })).toBeLessThan(7.4);
  await page.keyboard.down('KeyS'); await page.waitForTimeout(650); await page.keyboard.up('KeyS');
  expect(await page.evaluate(() => { const p = window.__RED_HORIZON__.run.player, o = window.qaRock; return Math.hypot(p.x - o.x, p.z - o.z) - o.radius - p.radius; })).toBeGreaterThanOrEqual(-0.001);
  const counts = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape'); await page.locator('#menu').click(); await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.time)).toBeGreaterThan(0.1);
    counts.push(await page.evaluate(() => window.__RED_HORIZON__.view.renderer.info.memory.geometries));
  }
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
});
