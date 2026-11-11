import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startStalkerAttack, advanceStalkerAttack } from '../src/ai/StalkerActions.js';
import { STALKER_CLIPS } from '../src/data/stalkerAnimations.js';
function fixture() {
  const run = new Run({ heightAt: () => 0, obstacles: [] }, 'stalker');
  const enemy = run.spawn('stalker', 0, 0); run.player.x = 0; run.player.z = 1; run.player.y = 0;
  enemy.attackTimer = 0; run.hurtPlayer = vi.fn(); return { run, enemy };
}
it('commits the attack, hits exactly at frame 12 once, and resumes pursuit after recovery', () => {
  const { run, enemy } = fixture(); updateEnemy(enemy, 1/60, run);
  expect(enemy.stalkerAction).toBeTruthy(); expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 11/30; updateEnemy(enemy, 1/60, run); expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 12/30; updateEnemy(enemy, 1/60, run); updateEnemy(enemy, 0, run);
  expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(enemy.damage);
  expect([enemy.x, enemy.z]).toEqual([0, 0]);
  run.player.z = 10; run.time = 1; updateEnemy(enemy, 1/60, run);
  expect(enemy.stalkerAction).toBeNull(); expect(enemy.state).toBe('Chase'); expect(enemy.z).toBeGreaterThan(0);
});
it.each(['range', 'behind', 'jump', 'stun', 'death'])('cancels contact when dodged or interrupted: %s', kind => {
  const { run, enemy } = fixture(); updateEnemy(enemy, 0, run);
  if(kind==='range') run.player.z=10;
  if(kind==='behind') run.player.z=-1;
  if(kind==='jump') run.player.y=5;
  if(kind==='stun') enemy.stun=.2;
  if(kind==='death') enemy.dead=true;
  run.time=.4; updateEnemy(enemy, 1/60, run); expect(run.hurtPlayer).not.toHaveBeenCalled();
  if(['stun','death'].includes(kind)) expect(enemy.stalkerAction).toBeNull();
  else { run.player.z=1;run.player.y=0;run.time=.5;updateEnemy(enemy,0,run);expect(run.hurtPlayer).not.toHaveBeenCalled(); }
});
it('uses playback speed for contact, survives skipped frames, and does not advance while paused', () => {
  const { run, enemy } = fixture(); enemy.attackSpeed=2;startStalkerAttack(enemy,0);
  run.time=.19;advanceStalkerAttack(enemy,run);expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.status='paused';run.update(5,{},0,{});expect(run.time).toBe(.19);
  run.time=.3;advanceStalkerAttack(enemy,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
  run.time=2;advanceStalkerAttack(enemy,run);expect(enemy.stalkerAction).toBeNull();expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
  run.status='playing';startStalkerAttack(enemy,2);run.time=3;advanceStalkerAttack(enemy,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(2);
});
it('ships the verified GLB with the animation contract and embedded textures', () => {
  const bytes=fs.readFileSync(new URL('../public/models/stalker.glb',import.meta.url));
  expect(bytes.equals(fs.readFileSync(new URL('../Modelos_Animados/stalker/stalker.glb',import.meta.url)))).toBe(true);
  const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  expect(j.animations.map(a=>a.name)).toEqual([...Object.keys(STALKER_CLIPS),'reference_pose']);
  expect(j.skins[0].joints).toHaveLength(38);expect(j.images.every(i=>i.bufferView!==undefined)).toBe(true);
});
