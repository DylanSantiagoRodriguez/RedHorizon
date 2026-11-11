import { test, expect } from '@playwright/test';
test('drone loads, synchronizes contact, pauses, dies and reuses its independent rig', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||(m.type()==='warning'&&/PropertyBinding|GLTF|AnimationMixer|drone/i.test(m.text())))errors.push(m.text());});
  await page.goto('/?qa');await page.locator('#start').click();
  const result=await page.evaluate(async()=>{
    const {updateEnemy}=await import('/src/ai/EnemyAI.js');
    const g=window.__RED_HORIZON__,r=g.run;g.pause();r.director.timer=999;r.enemies=[];g.entities.sync(r);
    const e=r.spawn('drone',0,0), other=r.spawn('drone',4,0);e.y=e.height;other.y=other.height;
    g.entities.sync(r);const mesh=g.entities.enemies.get(e.id),mesh2=g.entities.enemies.get(other.id);
    await Promise.all([mesh.userData.droneReady,mesh2.userData.droneReady]);g.entities.sync(r);
    const a=g.entities.droneAvatars.get(mesh),b=g.entities.droneAvatars.get(mesh2),names=[a.clip];
    const distinct=a.root.getObjectByName('pelvis')!==b.root.getObjectByName('pelvis');
    const forward=a.root.rotation.y;
    e.state='Chase';r.time+=.1;g.entities.sync(r);names.push(a.clip);e.state='Retreat';r.time+=.1;g.entities.sync(r);names.push(a.clip);
    r.player.x=10;r.player.z=0;r.player.y=e.y-e.height;e.attackTimer=0;
    let hits=0,origin;const original=r.combat.enemyShot.bind(r.combat);r.combat.enemyShot=(enemy,point)=>{hits++;origin={...point};original(enemy,point);};updateEnemy(e,0,r);const start=r.time;g.entities.sync(r);names.push(a.clip);
    r.time=start+11/30;updateEnemy(e,1/60,r);g.entities.sync(r);const before=hits;
    r.time=start+12/30;updateEnemy(e,1/60,r);g.entities.sync(r);const contact={hits,time:a.clipTime};const socket=a.socket();const socketError=Math.hypot(socket.x-origin.x,socket.y-origin.y,socket.z-origin.z);
    for(let i=0;i<10;i++)g.entities.sync(r);const frozen=a.clipTime===contact.time;
    e.stun=.2;updateEnemy(e,0,r);g.entities.sync(r);names.push(a.clip);
    r.world.heightAt=()=>2;e.y=14;mesh.position.y=14;
    e.dead=true;r.enemies=r.enemies.filter(x=>x!==e);g.entities.sync(r);names.push(a.clip);
    const retained=g.entities.corpses.has(mesh)&&mesh.visible;
    r.time+=.5;g.entities.sync(r);const fallen=mesh.position.y<14&&mesh.position.y>2;const frozenY=mesh.position.y;g.entities.sync(r);const fallPaused=mesh.position.y===frozenY;
    r.time+=1.7;g.entities.sync(r);const finalVisible=g.entities.corpses.has(mesh)&&mesh.visible;const box=a.bounds();const grounded=Math.abs(box.min.y-2)<.001;
    r.time+=.6;g.entities.sync(r);const hidden=!mesh.visible&&!g.entities.corpses.has(mesh);
    const replacement=r.spawn('drone',0,0);replacement.y=replacement.height;g.entities.sync(r);
    const reused=g.entities.enemies.get(replacement.id)===mesh&&a.clip==='hover'&&a.clipTime===0;
    document.querySelector('#interface').hidden=true;g.world.group.visible=false;g.missionView.group.visible=false;g.view.sky.visible=false;g.missionView.update=()=>{};
    g.view.scene.background.set('#17212a');g.view.scene.fog=null;g.entities.player.scale.setScalar(0);g.particles.dustMesh.visible=false;g.particles.reset();
    const fill=g.view.sun.clone();fill.intensity=3;fill.castShadow=false;fill.position.set(2,5,5);g.view.scene.add(fill);
    g.camera.update=()=>{g.view.camera.position.set(4,3,5);g.view.camera.lookAt(0,1.1,0);};
    return {groundY:box.min.y,fallen,fallPaused,grounded,socketError,names,distinct,forward,before,contact,frozen,retained,finalVisible,hidden,reused};
  });
  expect(result.names).toEqual(['hover','move_forward','move_backward','attack_ranged','hover','death']);
  expect(result.before).toBe(0);expect(result.contact.hits).toBe(1);expect(result.contact.time).toBeCloseTo(.4,5);
  expect(result.socketError).toBeLessThan(.0001);
  expect(result.forward).toBeCloseTo(0);
  for(const key of ['fallen','fallPaused','grounded','distinct','frozen','retained','finalVisible','hidden','reused'])expect(result[key],key+JSON.stringify(result)).toBe(true);
  const falls = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__, r = g.run, results = [];
    for (const height of [2.2, 80]) {
      const e = r.spawn('drone', 0, 0); e.y = height; g.entities.sync(r);
      const mesh = g.entities.enemies.get(e.id); await mesh.userData.droneReady; g.entities.sync(r);
      const avatar = g.entities.droneAvatars.get(mesh); e.dead = true; g.entities.sync(r);
      let min = Infinity, stillFalling = false;
      for (let i = 1; i <= 90; i++) {
        r.time += .1; g.entities.sync(r);
        if (g.entities.corpses.has(mesh)) min = Math.min(min, avatar.bounds().min.y);
        if (i === 23 && height === 80) stillFalling = g.entities.corpses.has(mesh) && mesh.position.y > 2;
      }
      results.push({ height, min, stillFalling, removed: !g.entities.corpses.has(mesh) && !mesh.visible });
    }
    return results;
  });
  for (const fall of falls) { expect(fall.min).toBeGreaterThanOrEqual(1.999); expect(fall.removed).toBe(true); }
  expect(falls[1].stillFalling).toBe(true);
  await page.screenshot({path:'Modelos_Animados/drone/in-game.png'});
  expect(errors).toEqual([]);
});
