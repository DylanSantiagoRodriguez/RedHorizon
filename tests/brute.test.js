import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startBruteAttack, advanceBruteAttack } from '../src/ai/BruteActions.js';
import { BRUTE_CLIPS } from '../src/data/bruteAnimations.js';
function fixture() {
  const run = new Run({ heightAt: () => 0, obstacles: [] }, 'brute');
  const enemy = run.spawn('brute', 0, 0); run.player.x = 0; run.player.z = 1; run.player.y = 0;
  enemy.attackTimer = 0; run.hurtPlayer = vi.fn(); return { run, enemy };
}
it('commits the attack, hits exactly at frame 18 once, and resumes pursuit after recovery', () => {
  const { run, enemy } = fixture(); updateEnemy(enemy, 1/60, run);
  expect(enemy.bruteAction).toBeTruthy(); expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 17/30; updateEnemy(enemy, 1/60, run); expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 18/30; updateEnemy(enemy, 1/60, run); updateEnemy(enemy, 0, run);
  expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(enemy.damage);
  expect([enemy.x, enemy.z]).toEqual([0, 0]);
  run.player.z = 10; run.time = 1.2; updateEnemy(enemy, 1/60, run);
  expect(enemy.bruteAction).toBeNull(); expect(enemy.state).toBe('Chase'); expect(enemy.z).toBeGreaterThan(0);
});
it.each(['range', 'behind', 'jump', 'stun', 'death'])('cancels contact when dodged or interrupted: %s', kind => {
  const { run, enemy } = fixture(); updateEnemy(enemy, 0, run);
  if(kind==='range') run.player.z=10;
  if(kind==='behind') run.player.z=-1;
  if(kind==='jump') run.player.y=5;
  if(kind==='stun') enemy.stun=.2;
  if(kind==='death') enemy.dead=true;
  run.time=.6; updateEnemy(enemy, 1/60, run); expect(run.hurtPlayer).not.toHaveBeenCalled();
  if(['stun','death'].includes(kind)) expect(enemy.bruteAction).toBeNull();
  else { run.player.z=1;run.player.y=0;run.time=.7;updateEnemy(enemy,0,run);expect(run.hurtPlayer).not.toHaveBeenCalled(); }
});
it('uses playback speed for contact, survives skipped frames, and does not advance while paused', () => {
  const { run, enemy } = fixture(); enemy.attackSpeed=2;startBruteAttack(enemy,0);
  run.time=.29;advanceBruteAttack(enemy,run);expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.status='paused';run.update(5,{},0,{});expect(run.time).toBe(.29);
  run.time=.3;advanceBruteAttack(enemy,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
  run.time=2;advanceBruteAttack(enemy,run);expect(enemy.bruteAction).toBeNull();expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
  run.status='playing';startBruteAttack(enemy,2);run.time=3;advanceBruteAttack(enemy,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(2);
});
it('ships the verified GLB with the animation contract and embedded textures', () => {
  const bytes=fs.readFileSync(new URL('../public/models/brute.glb',import.meta.url));
  expect(bytes.equals(fs.readFileSync(new URL('../Modelos_Animados/brute/brute.glb',import.meta.url)))).toBe(true);
  const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  expect(j.animations.map(a=>a.name)).toEqual([...Object.keys(BRUTE_CLIPS),'reference_pose']);
  expect(j.skins[0].joints).toHaveLength(49);expect(j.images.every(i=>i.bufferView!==undefined)).toBe(true);
});
