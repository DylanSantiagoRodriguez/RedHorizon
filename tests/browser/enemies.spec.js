import { test, expect } from '@playwright/test';

test('guardianes y enemigos: modelos distintos, efectos y reutilización', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?qa');
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  await page.locator('#start').click();
  const setup = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, r = g.run;
    await g.entities.avatarReady; r.director.timer = 999;
    for (const altar of r.altars) { r.player.x = altar.x; r.player.z = altar.z; r.boss.awaken(r, altar); }
    for (const [i, boss] of r.boss.guardians.entries()) {
      boss.x = (i - 2) * 8; boss.y = 3.5; boss.z = 0; boss.yaw = 0; boss.abilityTimer = 0;
      r.boss.updateBoss(0.01, r, boss);
    }
    g.entities.sync(r); g.pause();
    await Promise.all([...g.entities.enemies.values()].map(mesh => mesh.userData.dustReady));
    g.entities.sync(r);
    // Neutral inspection stage: these are the meshes produced by actual altar summons.
    document.querySelector('#interface').hidden = true;
    g.world.group.visible = false; g.missionView.group.visible = false; g.view.sky.visible = false;
    g.missionView.update = () => {};
    g.view.scene.background.set('#111c24'); g.view.scene.fog = null;
    const fill = g.view.sun.clone(); fill.color.setHex(0xc8e7ff); fill.intensity = 3; fill.castShadow = false;
    fill.position.set(0, 12, 15); g.view.scene.add(fill);
    g.entities.player.scale.setScalar(0); g.particles.dustMesh.visible = false;
    r.combat.pool.clear(); g.particles.reset(); r.boss.zones = [];
    r.player.x = 0; r.player.z = 0;
    g.models.part(g.view.scene, 'box', 0x26323b, [0, -0.2, 0], [48, 0.3, 12]);
    g.camera.update = () => { g.view.camera.position.set(0, 11, 30); g.view.camera.lookAt(0, 3.2, 0); };
    return { ids: r.boss.guardians.map(b => b.guardianId), keys: [...g.entities.enemies.values()].map(m => m.userData.modelKey) };
  });
  expect(new Set(setup.ids).size).toBe(5); expect(new Set(setup.keys).size).toBe(5);
  await page.screenshot({ path: 'docs/screenshots/guardians-neoforge.png' });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(i => {
      const g = window.__RED_HORIZON__, boss = g.run.boss.guardians[i];
      g.camera.update = () => { g.view.camera.position.set(boss.x + 7, 6.5, 10); g.view.camera.lookAt(boss.x, 3.3, 0); };
      g.particles.reset(); g.particles.guardian({ x: boss.x, y: boss.y, z: boss.z, guardianId: boss.guardianId, color: boss.gemColor });
      g.particles.update(0.1, g.run);
    }, i);
    await page.screenshot({ path: `docs/screenshots/guardian-${setup.ids[i]}.png` });
  }
  const pooled = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run, old = [...g.entities.enemies.values()];
    r.enemies = []; g.entities.sync(r);
    r.enemies = r.boss.guardians.map((b, i) => ({ ...b, id: 100 + i })); g.entities.sync(r);
    return [...g.entities.enemies.values()].every((m, i) => m === old[i]);
  });
  expect(pooled).toBe(true);
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run;
    r.enemies = []; g.entities.sync(r); g.particles.reset();
    for (const [i, type] of ['stalker', 'brute', 'drone', 'spitter', 'elite'].entries()) {
      const e = r.spawn(type, (i - 2) * 3.5, 0); e.y = e.height; e.yaw = 0;
    }
    g.entities.sync(r);
    g.camera.update = () => { g.view.camera.position.set(0, 6, 14); g.view.camera.lookAt(0, 1.5, 0); };
  });
  await page.screenshot({ path: 'docs/screenshots/enemies-neoforge.png' });
  expect(errors).toEqual([]);
});
