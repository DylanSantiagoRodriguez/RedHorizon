import { test, expect } from '@playwright/test';

test('amethyst loads from its GLB, transitions, pauses and completes death before disposal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || (message.type() === 'warning' && /PropertyBinding|GLTF|AnimationMixer|amethyst/i.test(message.text()))) errors.push(message.text());
  });
  await page.goto('/?qa'); await page.locator('#start').click();
  const loaded = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, r = g.run; g.pause(); r.director.timer = 999;
    const altar = r.altars[3]; r.player.x = altar.x; r.player.z = altar.z; r.boss.awaken(r, altar);
    const boss = r.boss.enemy; boss.x = 0; boss.z = 0; boss.y = boss.height; boss.yaw = 0;
    g.entities.sync(r); const mesh = g.entities.enemies.get(boss.id); await mesh.userData.amethystReady; g.entities.sync(r);
    document.querySelector('#interface').hidden = true;
    g.world.group.visible = false; g.missionView.group.visible = false; g.view.sky.visible = false; g.missionView.update = () => {};
    g.view.scene.background.set('#17212a'); g.view.scene.fog = null; g.entities.player.scale.setScalar(0);
    g.particles.dustMesh.visible = false; g.particles.reset();
    const fill = g.view.sun.clone(); fill.intensity = 3; fill.castShadow = false; fill.position.set(0, 10, 15); g.view.scene.add(fill);
    g.models.part(g.view.scene, 'box', 0x26323b, [0, -0.2, 0], [25, 0.3, 25]);
    g.camera.update = () => { g.view.camera.position.set(9, 7, 14); g.view.camera.lookAt(0, 3.2, 0); };
    const avatar = g.entities.amethystAvatars.get(mesh);
    return { clip: avatar.clip, core: !!avatar.socket('core_socket'), visible: mesh.children.filter(c => c.visible).map(c => c.name) };
  });
  expect(loaded).toEqual({ clip: 'idle', core: true, visible: ['amethyst-avatar'] });
  await page.screenshot({ path: 'Modelos_Animados/amethyst/in-game.png' });
  const transitions = await page.evaluate(async () => {
    const { startAmethystAction, advanceAmethystAction, amethystMuzzlePosition } = await import('/src/ai/AmethystActions.js');
    const g = window.__RED_HORIZON__, r = g.run, boss = r.boss.enemy, mesh = g.entities.enemies.get(boss.id), avatar = g.entities.amethystAvatars.get(mesh), names = [];

    boss.state = 'Chase'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    let socketError = 0; const lit = avatar.coreIntensity > 0;
    for (const name of ['attack_melee', 'attack_special', 'summon']) {
      startAmethystAction(boss, name, r.time); g.entities.sync(r); names.push(avatar.clip);
      r.time += 1; g.entities.sync(r);
      if (name === 'attack_special') {
        const actual = avatar.socket('muzzle_socket'), expected = amethystMuzzlePosition(boss);
        socketError = Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z);
      }
      r.time += 1; advanceAmethystAction(boss, r); g.entities.sync(r);
    }
    boss.stun = 0.4; r.time += 0.1; g.entities.sync(r); names.push(avatar.clip);
    r.time += 0.2; g.entities.sync(r); avatar.root.updateMatrixWorld(true);
    const bone = avatar.root.getObjectByName('pelvis'), before = bone.quaternion.toArray();
    for (let i = 0; i < 10; i++) g.entities.sync(r);
    const frozen = before.every((v, i) => v === bone.quaternion.toArray()[i]);
    boss.stun = 0; boss.state = 'Idle'; r.time += 0.2; g.entities.sync(r); names.push(avatar.clip);
    boss.dead = true; r.enemies = r.enemies.filter(e => e !== boss); g.entities.sync(r); names.push(avatar.clip);
    const retained = g.entities.corpses.size === 1 && mesh.visible;
    r.time += 2.4; g.entities.sync(r); const finalVisible = mesh.visible && g.entities.corpses.size === 1 && avatar.coreIntensity === 0;
    r.time += 0.6; g.entities.sync(r);
    return { socketError, lit, names, frozen, retained, finalVisible, removed: mesh.parent === null && !g.entities.amethystAvatars.has(mesh) };
  });
  expect(transitions.socketError).toBeLessThan(.001); expect(transitions.lit).toBe(true);
  expect(transitions.names).toEqual(['move', 'attack_melee', 'attack_special', 'summon', 'idle', 'idle', 'death']);
  expect(transitions.frozen && transitions.retained && transitions.finalVisible && transitions.removed).toBe(true);
  expect(errors).toEqual([]);
});



test('amethyst falls from actual height onto raised terrain and waits for landing', async ({page}) => {
 await page.goto('/?qa'); await page.locator('#start').click();
 const result=await page.evaluate(async()=>{
  const g=window.__RED_HORIZON__,r=g.run;g.pause();
  const {loadAmethystAvatar}=await import('/src/graphics/AmethystAvatar.js');
  const Group=g.entities.player.constructor;
  const results=[];
  for(const height of [7,60]) {
   const parent=new Group();g.view.scene.add(parent);
   const e={x:0,y:height,z:0,height:3.5,dead:false,stun:0,state:'Idle',phase:1};parent.position.y=height;
   const a=await loadAmethystAvatar(parent);a.update(e,0,r.world);e.dead=true;e.amethystDeathAt=0;
   const world={heightAt:()=>2};a.update(e,0,world);a.update(e,.2,world);
   const before=parent.position.y;a.update(e,.2,world);const frozen=parent.position.y===before;
   const earlyDone=a.update(e,2.5,world),stillAirborne=a.bounds().min.y>2.01;
   let done=false,t=2.5;
   while(!done&&t<10){t+=1/30;done=a.update(e,t,world);}
   results.push({height,frozen,earlyDone,stillAirborne,done,bottom:a.bounds().min.y,off:a.coreIntensity===0,finishedAt:t});
   a.dispose();parent.removeFromParent();
  }
  return results;
 });
 for(const r of result){expect(r.frozen&&r.done&&r.off).toBe(true);expect(r.bottom).toBeCloseTo(2,3);}
 expect(result[1].earlyDone).toBe(false);expect(result[1].stillAirborne).toBe(true);
 expect(result[1].finishedAt).toBeGreaterThan(result[0].finishedAt);
});
