import {test,expect} from '@playwright/test';
test('Aurora appears only in final shot and stays framed on wide and portrait screens',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?qa');await page.locator('#start').click();
 await page.evaluate(async()=>{const g=window.__RED_HORIZON__;g.pause();await g.missionView.auroraReady;g.view.renderer.setAnimationLoop(null);g.run.mission.phase='cinematic';g.state.value='playing';g.ui.show('playing');g.run.mission.cinematic=14.9;g.missionView.update();});
 expect(await page.evaluate(()=>window.__RED_HORIZON__.missionView.ark.visible)).toBe(false);
 for(const viewport of [{width:1440,height:900},{width:600,height:900}]){
  await page.setViewportSize(viewport);
  const result=await page.evaluate(()=>{
   const g=window.__RED_HORIZON__,m=g.missionView;g.view.resize();g.run.mission.cinematic=19;m.update();g.view.camera.updateMatrixWorld(true);g.view.scene.updateMatrixWorld(true);
   const points=[];m.aurora.root.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();const box=n.geometry.boundingBox;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=g.view.camera.position.clone().set(x,y,z).applyMatrix4(n.matrixWorld).project(g.view.camera);points.push([p.x,p.y,p.z]);}}});
   const before=g.view.camera.position.toArray();m.update();const frozen=before.every((v,i)=>v===g.view.camera.position.toArray()[i]);
   document.querySelectorAll('.screen').forEach(n=>{n.hidden=true;});g.view.draw();
   return {visible:m.ark.visible,loaded:!!m.aurora,frozen,inside:points.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z>-1&&z<1),fallback:m.ark.children.filter(c=>c.visible).map(c=>c.name)};
  });
  expect(result).toEqual({visible:true,loaded:true,frozen:true,inside:true,fallback:['aurora-model']});
  await page.screenshot({path:`outputs/aurora/final-${viewport.width}.png`});
 }
 expect(errors).toEqual([]);
});
