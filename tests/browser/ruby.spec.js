import { test, expect } from '@playwright/test';

test('ruby loads from its GLB, transitions, pauses and completes death before disposal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || (message.type() === 'warning' && /PropertyBinding|GLTF|AnimationMixer|ruby/i.test(message.text()))) errors.push(message.text());
  });
  await page.goto('/?qa'); await page.locator('#start').click();
  const loaded = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, r = g.run; g.pause(); r.director.timer = 999;
    const altar = r.altars[0]; r.player.x = altar.x; r.player.z = altar.z; r.boss.awaken(r, altar);
    const boss = r.boss.enemy; boss.x = 0; boss.z = 0; boss.y = boss.height; boss.yaw = 0;
    g.entities.sync(r); const mesh = g.entities.enemies.get(boss.id); await mesh.userData.rubyReady; g.entities.sync(r);
    document.querySelector('#interface').hidden = true;
    g.world.group.visible = false; g.missionView.group.visible = false; g.view.sky.visible = false; g.missionView.update = () => {};
    g.view.scene.background.set('#17212a'); g.view.scene.fog = null; g.entities.player.scale.setScalar(0);
    g.particles.dustMesh.visible = false; g.particles.reset();
    const fill = g.view.sun.clone(); fill.intensity = 3; fill.castShadow = false; fill.position.set(0, 10, 15); g.view.scene.add(fill);
    g.models.part(g.view.scene, 'box', 0x26323b, [0, -0.2, 0], [25, 0.3, 25]);
    g.camera.update = () => { g.view.camera.position.set(9, 7, 14); g.view.camera.lookAt(0, 3.2, 0); };
    const avatar = g.entities.rubyAvatars.get(mesh);
    return { clip: avatar.clip, core: !!avatar.socket('core_socket'), visible: mesh.children.filter(c => c.visible).map(c => c.name) };
  });
  expect(loaded).toEqual({ clip: 'spawn', core: true, visible: ['ruby-avatar'] });
  await page.screenshot({ path: 'Modelos_Animados/ruby/in-game.png' });
  const transitions = await page.evaluate(async () => {
    const { startRubyAction, advanceRubyAction, rubyMuzzlePosition } = await import('/src/ai/RubyActions.js');
    const g = window.__RED_HORIZON__, r = g.run, boss = r.boss.enemy, mesh = g.entities.enemies.get(boss.id), avatar = g.entities.rubyAvatars.get(mesh), names = [];
    r.time += 2; advanceRubyAction(boss, r);
    boss.state = 'Chase'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    let socketError = 0; const lit = avatar.coreIntensity > 0;
    for (const name of ['attack_melee', 'attack_special', 'summon']) {
      startRubyAction(boss, name, r.time); g.entities.sync(r); names.push(avatar.clip);
      r.time += 1; g.entities.sync(r);
      if (name === 'attack_special') {
        const actual = avatar.socket('muzzle_socket'), expected = rubyMuzzlePosition(boss);
        socketError = Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z);
      }
      r.time += 1; advanceRubyAction(boss, r); g.entities.sync(r);
    }
    boss.stun = 0.4; r.time += 0.1; g.entities.sync(r); names.push(avatar.clip);
    r.time += 0.2; g.entities.sync(r); avatar.root.updateMatrixWorld(true);
    const bone = avatar.root.getObjectByName('mixamorigSpine1'), before = bone.quaternion.toArray();
    for (let i = 0; i < 10; i++) g.entities.sync(r);
    const frozen = before.every((v, i) => v === bone.quaternion.toArray()[i]);
    boss.stun = 0; boss.state = 'Idle'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    boss.dead = true; r.enemies = r.enemies.filter(e => e !== boss); g.entities.sync(r); names.push(avatar.clip);
    const retained = g.entities.corpses.size === 1 && mesh.visible;
    r.time += 2.4; g.entities.sync(r); const finalVisible = mesh.visible && g.entities.corpses.size === 1 && avatar.coreIntensity === 0;
    r.time += 0.6; g.entities.sync(r);
    return { socketError, lit, names, frozen, retained, finalVisible, removed: mesh.parent === null && !g.entities.rubyAvatars.has(mesh) };
  });
  expect(transitions.socketError).toBeLessThan(.001); expect(transitions.lit).toBe(true);
  expect(transitions.names).toEqual(['move', 'attack_melee', 'attack_special', 'summon', 'idle', 'idle', 'death']);
  expect(transitions.frozen && transitions.retained && transitions.finalVisible && transitions.removed).toBe(true);
  expect(errors).toEqual([]);
});
