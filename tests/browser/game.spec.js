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
  await expect(page.getByText('Pulso', { exact: true })).toBeVisible();
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
test('cinco gemas, lanzamiento, extinción y epílogo', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#start').click();
  await page.evaluate(() => {
    const r = window.__RED_HORIZON__.run;
    for (const altar of r.altars) { r.player.x = altar.x; r.player.z = altar.z; r.boss.awaken(r, altar); }
    for (const boss of r.boss.guardians) r.combat.hit(boss, 100000);
    for (const gem of r.gems) gem.collected = true;
    r.player.x = 0; r.player.z = 7; r.director.timer = 999;
  });
  await expect(page.locator('#objective')).toHaveText('Lleva las gemas a la baliza');
  await expect(page.locator('#interaction')).toContainText('LANZAR BALIZA');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#boss-arrival')).toContainText('EXTINCIÓN EN');
  await page.evaluate(() => { window.__RED_HORIZON__.run.mission.countdown = 0.01; });
  await expect(page.locator('.mission-cinema')).toBeVisible();
  await page.evaluate(() => { window.__RED_HORIZON__.run.mission.cinematic = 8; });
  await expect(page.locator('.cinema-copy')).toContainText('Nadie vendría');
  await page.screenshot({ path: 'docs/screenshots/last-soldier.png' });
  await page.evaluate(() => { window.__RED_HORIZON__.run.mission.cinematic = 17; });
  await expect(page.locator('.cinema-copy')).toContainText('Tenemos un mañana');
  await page.screenshot({ path: 'docs/screenshots/aurora.png' });
  await page.evaluate(() => { window.__RED_HORIZON__.run.mission.cinematic = 23.99; });
  await expect(page.getByRole('heading', { name: 'La última luz' })).toBeVisible();
  expect(await page.evaluate(() => window.__RED_HORIZON__.save.data.wins)).toBe(1);
  await page.locator('#restart').click();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.mission.phase)).toBe('collect');
  await expect(page.locator('.mission-cinema')).toBeHidden();
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

test('altares: inicio sin jefe, invocación con E y persecución', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#start').click();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.boss.guardians.length)).toBe(0);
  await expect(page.locator('#boss-bar')).toBeHidden();
  await page.evaluate(() => {
    const r = window.__RED_HORIZON__.run, a = r.altars[0];
    r.director.timer = 999; r.player.x = a.x; r.player.z = a.z;
  });
  await expect(page.locator('#interaction')).toContainText('INVOCAR');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#boss-bar')).toBeVisible();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.boss.guardians.length)).toBe(1);
  await page.evaluate(() => {
    const r = window.__RED_HORIZON__.run, b = r.boss.enemy;
    window.bossStart = { x: b.x, z: b.z };
    r.player.x = 0; r.player.z = 0;
  });
  await expect.poll(() => page.evaluate(() => {
    const b = window.__RED_HORIZON__.run.boss.enemy;
    return Math.hypot(b.x - window.bossStart.x, b.z - window.bossStart.z);
  })).toBeGreaterThan(0.5);
});

test('personaje importado, bunnyhop y deslizamiento', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => !!window.__RED_HORIZON__.entities.avatar)).toBe(true);
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__; g.run.director.timer = 999;
    g.run.player.vz = -10; g.input.pressed.add('ControlLeft');
  });
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.player.slideTime)).toBeGreaterThan(0);
  await page.screenshot({ path: 'docs/screenshots/player-slide.png' });
  await page.keyboard.down('KeyW'); await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.player.hopChain), { timeout: 15000 }).toBeGreaterThan(1);
  await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'docs/screenshots/player-avatar.png' });
});

test('reasigna controles, guarda, aplica en partida y restaura', async ({ page }) => {
  await page.goto('/?qa'); await page.locator('#options').click();
  await page.locator('#quality').selectOption('low');
  await page.getByRole('button', { name: 'Controles', exact: true }).click();
  await page.locator('[data-binding="Space"]').click(); await page.keyboard.press('KeyR');
  await expect(page.locator('[data-binding="Space"]')).toHaveText('R');
  await page.locator('[data-binding="KeyW"]').click(); await page.keyboard.press('KeyS');
  await expect(page.locator('[data-binding="KeyW"]')).toHaveText('S');
  await expect(page.locator('[data-binding="KeyS"]')).toHaveText('W');
  await page.locator('[data-binding="KeyQ"]').click(); await page.keyboard.press('Escape');
  await expect(page.locator('[data-binding="KeyQ"]')).toHaveText('Q');
  await page.screenshot({ path: 'docs/screenshots/options-controls.png' });
  await page.locator('#back').click(); await page.reload(); await page.locator('#start').click();
  expect(await page.evaluate(() => window.__RED_HORIZON__.input.bindings.Space)).toBe('KeyR');
  await page.keyboard.down('KeyR');
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.player.grounded)).toBe(false);
  await page.keyboard.up('KeyR');
  expect(await page.evaluate(() => window.__RED_HORIZON__.input.bindings.KeyW)).toBe('KeyS');
  await page.keyboard.press('Escape'); await page.locator('#options').click();
  await page.getByRole('button', { name: 'Controles', exact: true }).click();
  await page.locator('#reset-bindings').click();
  await expect(page.locator('[data-binding="Space"]')).toHaveText('Espacio');
  await expect(page.locator('[data-binding="KeyW"]')).toHaveText('W');
  await page.locator('[data-binding="Mouse0"]').click(); await page.keyboard.press('KeyR');
  await expect(page.locator('[data-binding="Mouse0"]')).toHaveText('R');
  await page.locator('#back').click(); await page.locator('#resume').click();
  await page.evaluate(() => { const r = window.__RED_HORIZON__.run, emit = r.emit; window.remappedShots = 0; r.emit = (event, data) => { if (event === 'shot') window.remappedShots++; emit(event, data); }; });
  await page.keyboard.down('KeyR');
  await expect.poll(() => page.evaluate(() => window.remappedShots), { timeout: 10000 }).toBeGreaterThan(0);
  await page.keyboard.up('KeyR');
});

test('menú e ilustraciones neofuturistas: archivo completo y selección de aumento', async ({ page }) => {
  await page.goto('/?qa');
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  await page.locator('.neo-menu').evaluate(async el => {
    const match = getComputedStyle(el).getPropertyValue('--menu-art').match(/url\(['"]?(.*?)['"]?\)/);
    const image = new Image(); image.src = match[1]; await image.decode();
  });
  await page.screenshot({ path: 'docs/screenshots/menu-neoforge.png' });
  await page.locator('#augment-archive').click();
  await expect(page.locator('.archive-cards .neo-card')).toHaveCount(15);
  await page.locator('.archive-cards img').evaluateAll(async images => {
    await Promise.all(images.map(async img => { img.loading = 'eager'; await img.decode(); }));
  });
  expect(await page.locator('.archive-cards img').evaluateAll(images => images.every(img => img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/augment-archive.png' });
  await page.locator('#back').click(); await page.locator('#start').click();
  await page.evaluate(async () => {
    const { UPGRADES } = await import('/src/data/upgrades.js');
    const g = window.__RED_HORIZON__;
    g.run.director.timer = 999; g.run.experience.pending = 1;
    g.run.upgrades.offers = ['damage', 'shield', 'multishot'].map(id => UPGRADES.find(u => u.id === id));
    g.change('upgrade');
  });
  await expect(page.locator('button.neo-card')).toHaveCount(3);
  await page.locator('.neo-upgrades img').evaluateAll(async images => { await Promise.all(images.map(img => img.decode())); });
  await page.screenshot({ path: 'docs/screenshots/upgrade-cards-neoforge.png' });
  await page.locator('[data-upgrade="damage"]').click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__RED_HORIZON__.run.player.stats.damage)).toBeCloseTo(1.2);
  await page.keyboard.press('Escape'); await page.locator('#menu').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.locator('.neo-menu').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/menu-neoforge-narrow.png' });
});

test('armas de cobre: modelos, fogonazos y cambio de arma', async ({ page }) => {
  await page.goto('/?qa');
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  await page.locator('#start').click();
  await page.evaluate(async () => { const g = window.__RED_HORIZON__; g.run.director.timer = 999; await g.entities.avatarReady; });
  for (const [key, kind] of [['Digit1', 'plasma'], ['Digit2', 'scatter'], ['Digit3', 'nova']]) {
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(kind => window.__RED_HORIZON__.entities.weapons.variants[kind].root.visible, kind)).toBe(true);
    const result = await page.evaluate(kind => {
      const g = window.__RED_HORIZON__, r = g.run;
      r.weapon.timer = 0; r.weapon.fire(r, { x: 0, y: 0, z: -1 });
      g.entities.sync(r); g.pause();
      document.querySelector('#overlay').hidden = true;
      // Fixed close-up only for inspecting the actual in-game geometry.
      g.camera.update = () => { g.view.camera.position.set(r.player.x - 2.5, r.player.y + 2.1, r.player.z - 1.8); g.view.camera.lookAt(r.player.x - 0.3, r.player.y + 1.25, r.player.z - 0.5); };
      return { flash: g.entities.weapons.variants[kind].flash.visible, particles: g.particles.pool.items.filter(p => p.active).length, projectiles: r.combat.pool.items.filter(p => p.active && p.kind === kind).length };
    }, kind);
    expect(result.flash).toBe(true); expect(result.particles).toBeGreaterThan(0);
    expect(result.projectiles).toBe(kind === 'scatter' ? 6 : 1);
    await page.screenshot({ path: `docs/screenshots/weapon-${kind}.png` });
    await page.evaluate(() => { const g = window.__RED_HORIZON__; g.run.combat.pool.clear(); g.resume(); });
  }
});

test('HUD de cobre: vida, escudo, radar y selección de armas', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?qa');
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  await page.locator('#start').click();
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run;
    r.director.timer = 999; r.player.hp = 96; r.player.stats.shield = 50; r.player.shield = 50;
    r.gems = [{ color: 0xff5060, collected: true }, { color: 0x50e090, collected: true }];
    r.spawn('stalker', 35, -25); r.spawn('drone', -40, -20);
    g.ui.hud.toastUntil = 0;
  });
  await expect(page.locator('#health-meter')).toHaveAttribute('aria-valuenow', '96');
  await expect(page.locator('[data-gem].collected')).toHaveCount(2);
  await expect(page.locator('#shield')).toHaveText('50');
  await expect(page.locator('#shield-fill')).toHaveAttribute('style', 'width: 100%;');
  await page.screenshot({ path: 'docs/screenshots/hud-neoforge.png' });
  await page.keyboard.press('Digit2');
  await expect(page.locator('[data-weapon="scatter"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-weapon="nova"]').click();
  await expect(page.locator('[data-weapon="nova"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('#ability-button')).toHaveAttribute('aria-label', /recargando/);
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.run.player.hp = 24; g.ui.hud.toastUntil = 0; });
  await expect(page.locator('#vital-status')).toHaveText('VIDA CRÍTICA');
  await expect(page.locator('.vitals')).toHaveClass(/critical/);
  await page.screenshot({ path: 'docs/screenshots/hud-neoforge-critical.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: 'docs/screenshots/hud-neoforge-720.png' });
  const panels = await page.locator('.vitals, .loadout, .mission, .telemetry').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }));
  expect(panels.every(r => r.left >= 0 && r.top >= 0 && r.right <= 1280 && r.bottom <= 720)).toBe(true);
});
