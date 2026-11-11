import {test,expect} from '@playwright/test';
test('beacon launches parts 1 2 3 together while part 0 stays grounded',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?qa');await page.locator('#start').click();
 const result=await page.evaluate(async()=>{
  const g=window.__RED_HORIZON__;g.pause();await g.missionView.beaconReady;const b=g.missionView.beacon;
  const parts=[0,1,2,3].map(i=>b.root.getObjectByName('tripo_part_'+i));
  b.root.updateMatrixWorld(true);const before=parts.map(p=>p.matrixWorld.elements.slice());
  const mission={phase:'countdown',countdown:58};b.update(mission,[]);b.root.updateMatrixWorld(true);
  const delta=parts.map((p,i)=>p.matrixWorld.elements[13]-before[i][13]);const fixed=parts[0].matrixWorld.elements.every((v,i)=>v===before[0][i]);
  b.update(mission,[]);b.root.updateMatrixWorld(true);const paused=parts[2].matrixWorld.elements[13]===before[2][13]+delta[2];
  document.querySelector('#interface').hidden=true;g.missionView.update=()=>{};g.view.scene.fog=null;
  const ground=g.world.heightAt(0,7);g.camera.update=()=>{g.view.camera.position.set(8,ground+7,17);g.view.camera.lookAt(0,ground+3,7);};
  return {delta,fixed,paused,parents:parts.map(p=>p.parent.name),gems:b.sockets.every(s=>s.visible)};
 });
 expect(result.parents).toEqual(['beacon_base','beacon_capsule','beacon_capsule','beacon_capsule']);
 expect(result.fixed&&result.paused&&result.gems).toBe(true);for(const d of result.delta.slice(1))expect(d).toBeCloseTo(3.2,5);
 await page.screenshot({path:'Modelos_Animados/beacon/launch.png'});expect(errors).toEqual([]);
});
