import {test,expect} from '@playwright/test';
test('seeded imported world loads and all hidden plushies grant the set bonus',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?qa');await page.locator('#start').click();
 const result=await page.evaluate(async()=>{
  const g=window.__RED_HORIZON__;g.pause();await g.world.environmentReady;
  const w=g.world,r=g.run;
  const loaded={ready:w.environmentLoaded,error:w.environmentError,count:w.plushies.length,meshes:w.plushies.every(p=>!!p.mesh),variant:w.terrain.worldVariant};
  g.camera.update=()=>{g.view.camera.position.set(70,65,85);g.view.camera.lookAt(0,0,0);};
  document.querySelector('#interface').hidden=true;
  g.view.scene.fog=null;
  r.status='playing';
  for(const p of w.plushies){r.player.x=p.x;r.player.y=p.y;r.player.z=p.z;r.interaction=p;r.interact();}
  r.status='paused';w.update(r.time);
  return {...loaded,power:r.plushPower,damage:r.player.stats.damage,hidden:w.plushies.every(p=>!p.mesh.visible)};
 });
 expect(result).toMatchObject({ready:true,count:5,meshes:true,power:true,damage:4,hidden:true});expect(result.error).toBeUndefined();
 await page.screenshot({path:'outputs/environment/in-game.png'});expect(errors).toEqual([]);
});

