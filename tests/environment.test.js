import { expect,it } from 'vitest';
import { TerrainGenerator } from '../src/world/TerrainGenerator.js';
import { hiddenPlushies,collectPlush } from '../src/world/Plushies.js';
import { Run } from '../src/core/Run.js';
it('seeded arenas and hiding places repeat, with five separated accessible collectibles',()=>{
 for(let i=0;i<100;i++){
  const seed='secrets-'+i,t=new TerrainGenerator(seed),p=hiddenPlushies(t,t.rocks,seed);
  expect(p).toHaveLength(5);expect(p).toEqual(hiddenPlushies(new TerrainGenerator(seed),t.rocks,seed));
  for(const a of p){expect(t.rocks.every(r=>Math.hypot(a.x-r.x,a.z-r.z)>r.radius+.8)).toBe(true);expect(Math.abs(t.heightAt(a.x,a.z)-a.y)).toBeLessThan(.001);}
 }
 expect(new TerrainGenerator('a').rocks).not.toEqual(new TerrainGenerator('b').rocks);
});
it('requires proximity and awards the complete set exactly once per run',()=>{
 const world={heightAt:()=>0,obstacles:[],plushies:Array.from({length:5},(_,i)=>({id:i,x:50+i*3,y:0,z:0,used:false}))},run=new Run(world,'collect');
 expect(collectPlush(run,world.plushies[0])).toBe(false);
 for(const [i,p] of world.plushies.entries()){run.player.x=p.x;expect(collectPlush(run,p)).toBe(true);expect(collectPlush(run,p)).toBe(false);if(i<4)expect(run.player.stats.damage).toBe(1);}
 expect(run.plushCount).toBe(5);expect(run.player.stats.damage).toBe(4);expect(run.player.hp).toBe(620);expect(run.player.shield).toBe(300);
});
