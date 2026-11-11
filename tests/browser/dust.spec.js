import { test, expect } from '@playwright/test';

test('dust loads from its GLB, transitions, pauses and completes death before disposal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || (message.type() === 'warning' && /PropertyBinding|GLTF|AnimationMixer|dust/i.test(message.text()))) errors.push(message.text());
  });
  await page.goto('/?qa'); await page.locator('#start').click();
  const loaded = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, r = g.run; g.pause(); r.director.timer = 999;
    const altar = r.altars[4]; r.player.x = altar.x; r.player.z = altar.z; r.boss.awaken(r, altar);
    const boss = r.boss.enemy; boss.x = 0; boss.z = 0; boss.y = boss.height; boss.yaw = 0;
    g.entities.sync(r); const mesh = g.entities.enemies.get(boss.id); await mesh.userData.dustReady; g.entities.sync(r);
    document.querySelector('#interface').hidden = true;
    g.world.group.visible = false; g.missionView.group.visible = false; g.view.sky.visible = false; g.missionView.update = () => {};
    g.view.scene.background.set('#17212a'); g.view.scene.fog = null; g.entities.player.scale.setScalar(0);
    g.particles.dustMesh.visible = false; g.particles.reset();
    const fill = g.view.sun.clone(); fill.intensity = 3; fill.castShadow = false; fill.position.set(0, 10, 15); g.view.scene.add(fill);
    g.models.part(g.view.scene, 'box', 0x26323b, [0, -0.2, 0], [25, 0.3, 25]);
    g.camera.update = () => { g.view.camera.position.set(9, 7, 14); g.view.camera.lookAt(0, 3.2, 0); };
    const avatar = g.entities.dustAvatars.get(mesh);
    return { clip: avatar.clip, core: !!avatar.socket('core_socket'), visible: mesh.children.filter(c => c.visible).map(c => c.name) };
  });
  expect(loaded).toEqual({ clip: 'idle', core: true, visible: ['dust-avatar'] });
  await page.screenshot({ path: 'Modelos_Animados/dust/in-game.png' });
  const transitions = await page.evaluate(async () => {
    const { startDustAction, advanceDustAction } = await import('/src/ai/DustActions.js');
    const g = window.__RED_HORIZON__, r = g.run, boss = r.boss.enemy, mesh = g.entities.enemies.get(boss.id), avatar = g.entities.dustAvatars.get(mesh), names = [];
    boss.state = 'Chase'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    for (const name of ['attack_melee', 'attack_special', 'summon']) {
      startDustAction(boss, name, r.time); g.entities.sync(r); names.push(avatar.clip);
      r.time += 2; advanceDustAction(boss, r); g.entities.sync(r);
    }
    boss.stun = 0.4; r.time += 0.1; g.entities.sync(r); names.push(avatar.clip);
    r.time += 0.2; g.entities.sync(r); avatar.root.updateMatrixWorld(true);
    const bone = avatar.root.getObjectByName('mixamorigSpine1'), before = bone.quaternion.toArray();
    for (let i = 0; i < 10; i++) g.entities.sync(r);
    const frozen = before.every((v, i) => v === bone.quaternion.toArray()[i]);
    boss.stun = 0; boss.state = 'Idle'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    boss.dead = true; r.enemies = r.enemies.filter(e => e !== boss); g.entities.sync(r); names.push(avatar.clip);
    const retained = g.entities.corpses.size === 1 && mesh.visible;
    r.time += 2.4; g.entities.sync(r); const finalVisible = mesh.visible && g.entities.corpses.size === 1;
    r.time += 0.6; g.entities.sync(r);
    return { names, frozen, retained, finalVisible, removed: mesh.parent === null && !g.entities.dustAvatars.has(mesh) };
  });
  expect(transitions.names).toEqual(['move', 'attack_melee', 'attack_special', 'summon', 'stunned', 'idle', 'death']);
  expect(transitions.frozen && transitions.retained && transitions.finalVisible && transitions.removed).toBe(true);
  expect(errors).toEqual([]);
});

test('exported reference and seven clips render without binding errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall due to ReadPixels/.test(m.text()))) errors.push(m.text());
  });
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto('/scripts/preview-dust.html'); await page.waitForFunction(() => window.dustPreview);
  await page.evaluate(() => window.dustPreview.pose('reference_pose'));
  await page.screenshot({ path: 'Modelos_Animados/dust/reference-pose.png' });
  const pictures = await page.evaluate(() => {
    const p = window.dustPreview, pictures = [];
    p.renderer.setAnimationLoop(null); p.renderer.setSize(400, 360); p.camera.aspect = 400 / 360; p.camera.updateProjectionMatrix();
    for (const clip of p.asset.animations.filter(c => c.name !== 'reference_pose')) {
      for (const fraction of [0, 1 / 3, 2 / 3, 1]) {
        const time = fraction * clip.duration; p.pose(clip.name, time);
        pictures.push({ title: `${clip.name} · frame ${Math.round(time * 30)}`, image: p.renderer.domElement.toDataURL() });
      }
    }
    return pictures;
  });
  await page.setViewportSize({ width: 1600, height: 2760 });
  await page.setContent('<body style="margin:0;background:#17212a;color:#eed8a5;font:18px system-ui"><h1 style="margin:20px">TITÁN DEL POLVO · 30 FPS · BASE</h1><main style="display:grid;grid-template-columns:repeat(4,400px)"></main></body>');
  await page.evaluate(pictures => {
    const main = document.querySelector('main');
    for (const pic of pictures) {
      const box = document.createElement('div'), label = document.createElement('div'), img = document.createElement('img');
      label.textContent = pic.title; label.style.paddingLeft = '16px'; img.src = pic.image; img.style.display = 'block'; box.append(label, img); main.append(box);
    }
  }, pictures);
  await page.screenshot({ path: 'Modelos_Animados/dust/clip-review.png', fullPage: true });
  expect(errors).toEqual([]);
});
