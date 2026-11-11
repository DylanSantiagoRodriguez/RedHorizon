import { test, expect } from '@playwright/test';

test('robot Mixamo: clips, texturas, poses y bloqueo de disparo al deslizarse', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('No se pudo cargar el personaje')) errors.push(m.text()); });
  await page.goto('/?qa');
  await page.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.applyOptions(); });
  await page.locator('#start').click();
  const info = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; await g.entities.avatarReady;
    if (!g.entities.avatar) throw new Error('Avatar no disponible');
    g.run.director.timer = 999;
    let mesh; g.entities.avatar.root.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    return { clips: [...g.entities.avatar.clips.keys()], vertices: mesh.geometry.attributes.position.count, textured: !!mesh.material.map, normals: !!mesh.material.normalMap };
  });
  expect(info.clips).toHaveLength(19); expect(info.textured).toBe(true); expect(info.normals).toBe(true);
  await page.keyboard.down('KeyS');
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.entities.avatar.actions.get('walk_backward').getEffectiveWeight())).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyS');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.entities.avatar.state)).toBe('jump');
  await expect.poll(() => page.evaluate(() => window.__RED_HORIZON__.run.player.grounded)).toBe(true);
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__; g.pause();
    g.missionView.update = () => {}; g.world.group.visible = false; g.missionView.group.visible = false; g.view.sky.visible = false;
    g.view.scene.background.set('#17252d'); g.view.scene.fog = null;
    document.querySelector('#interface').hidden = true; g.particles.dustMesh.visible = false;
    const fill = g.view.sun.clone(); fill.castShadow = false; fill.intensity = 3; fill.position.set(0, 8, 8); g.view.scene.add(fill);
    const p = g.run.player; p.x = 0; p.y = 0; p.z = 0; p.yaw = 0; p.vx = 0; p.vz = 0;
    g.run.weapon.aim = { x: 0, y: 0, z: 1 };
    g.models.part(g.view.scene, 'box', 0x31434a, [0, -0.06, 0], [6, 0.1, 6]);
    for (let i = 0; i < 20; i++) g.entities.sync(g.run, 1 / 30);
    g.camera.update = () => { g.view.camera.position.set(3.1, 2, 4.3); g.view.camera.lookAt(0, 1.15, 0); };
  });
  await page.screenshot({ path: 'docs/screenshots/player-mixamo-idle.png' });
  const pose = await page.evaluate(() => {
    const a = window.__RED_HORIZON__.entities.avatar; let mesh;
    a.root.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    mesh.skeleton.update(); mesh.computeBoundingBox(); const box = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    return { height: box.max.y - box.min.y, feet: box.min.y };
  });
  expect(pose.height).toBeGreaterThan(2); expect(pose.height).toBeLessThan(2.4); expect(Math.abs(pose.feet)).toBeLessThan(0.1);
  const slide = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run;
    r.player.slideTime = 0.4; r.weapon.timer = 0;
    for (let i = 0; i < 20; i++) g.entities.sync(r, 1 / 30);
    return { state: g.entities.avatar.state, fired: r.weapon.fire(r, { x: 0, y: 0, z: 1 }), weight: g.entities.avatar.actions.get('slide').getEffectiveWeight() };
  });
  expect(slide.state).toBe('slide'); expect(slide.fired).toBe(false); expect(slide.weight).toBeGreaterThan(0.95);
  await page.screenshot({ path: 'docs/screenshots/player-mixamo-slide.png' });
  await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run;
    r.player.slideTime = 0; r.player.grounded = false; r.player.vy = 0; r.player.y = 1;
    r.weapon.aim = { x: 0, y: 0.8, z: 0.6 };
    for (let i = 0; i < 20; i++) g.entities.sync(r, 1 / 30);
  });
  await page.screenshot({ path: 'docs/screenshots/player-mixamo-jump.png' });
  const stable = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, a = g.entities.avatar;
    g.entities.sync(g.run, 0);
    const before = a.bones.get('Spine2').quaternion.clone();
    for (let i = 0; i < 60; i++) g.entities.sync(g.run, 0);
    return before.angleTo(a.bones.get('Spine2').quaternion);
  });
  expect(stable).toBeLessThan(0.00001);
  const extras = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, r = g.run, a = g.entities.avatar;
    r.player.grounded = true; r.player.y = 0; r.weapon.timer = 0;
    r.weapon.fire(r, { x: 0, y: 0, z: 1 }); r.player.hurt(1); r.player.interactSerial++;
    g.entities.sync(r, 1 / 60);
    const layers = ['fire', 'hit_react', 'interact'].map(n => a.overlays.get(n).action.isRunning());
    r.player.dead = true; for (let i = 0; i < 10; i++) g.entities.sync(r, 0.1);
    const deathTime = a.actions.get('death').time;
    r.mission.phase = 'cinematic'; for (let i = 0; i < 10; i++) g.entities.sync(r, 0.1);
    return { layers, deathTime, finalState: a.state, finalTime: a.actions.get('final_collapse').time };
  });
  expect(extras.layers).toEqual([true, true, true]); expect(extras.deathTime).toBeGreaterThan(0.9);
  expect(extras.finalState).toBe('final_collapse'); expect(extras.finalTime).toBeGreaterThan(0.9);
  expect(errors).toEqual([]);
});
