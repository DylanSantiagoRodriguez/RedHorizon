import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { advanceDustAction, startDustAction } from '../src/ai/DustActions.js';
import { DUST_CLIPS } from '../src/data/dustAnimations.js';

function fixture() {
  const run = new Run({ heightAt: () => 0, obstacles: [] }, 'dust');
  const boss = run.spawn('titan', 0, 0); boss.guardianId = 'dust'; boss.gemColor = 0xffd050;
  run.boss.guardians.push(boss); run.hurtPlayer = vi.fn();
  return { run, boss };
}

it('melee hits once at contact, stops moving, and can be dodged', () => {
  const { run, boss } = fixture(); boss.attackTimer = 0; run.player.z = 3;
  updateEnemy(boss, 1 / 60, run); expect(boss.dustAction.name).toBe('attack_melee');
  expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 13 / 30; updateEnemy(boss, 1 / 60, run); expect(run.hurtPlayer).not.toHaveBeenCalled();
  run.time = 14 / 30; updateEnemy(boss, 1 / 60, run); expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(boss.damage);
  updateEnemy(boss, 1 / 60, run); expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
  expect(boss.x).toBe(0); expect(boss.z).toBe(0);
  run.time = 1; advanceDustAction(boss, run); startDustAction(boss, 'attack_melee', run.time);
  run.player.z = 20; run.time = 2; advanceDustAction(boss, run); expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
});

it.each(['attack_special', 'summon'])('%s fires at the marker even across skipped frames, but cancels on stun/death', name => {
  const { run, boss } = fixture(), method = name === 'summon' ? 'releaseSummon' : 'releaseAbility';
  const spy = vi.spyOn(run.boss, method);
  startDustAction(boss, name, run.time);
  run.time = DUST_CLIPS[name].eventFrame / 30 - 0.01; advanceDustAction(boss, run); expect(spy).not.toHaveBeenCalled();
  run.time = 3; advanceDustAction(boss, run); advanceDustAction(boss, run); expect(spy).toHaveBeenCalledTimes(1);
  expect(boss.dustAction).toBeNull();
  startDustAction(boss, name, run.time); boss.stun = 0.5; run.time = 6; updateEnemy(boss, 0.01, run);
  expect(boss.state).toBe('Stunned'); expect(boss.dustAction).toBeNull(); expect(spy).toHaveBeenCalledTimes(1);
  boss.stun = 0; startDustAction(boss, name, run.time); boss.dead = true; run.time = 9; advanceDustAction(boss, run);
  expect(spy).toHaveBeenCalledTimes(1);
});

it('serializes special/summon, retaining golden effects and the configured summon count', () => {
  const { run, boss } = fixture(); boss.abilityTimer = 0; boss.summonTimer = 0;
  run.boss.updateBoss(0, run, boss); expect(boss.dustAction.name).toBe('attack_special');
  expect(run.boss.zones).toHaveLength(0); expect(run.enemies).toHaveLength(1);
  run.time = 20 / 30; advanceDustAction(boss, run);
  expect(run.boss.zones[0].color).toBe(0xffd050);
  expect(run.combat.pool.items.filter(p => p.active).every(p => p.color === 0xffd050)).toBe(true);
  run.boss.updateBoss(0, run, boss); expect(boss.dustAction.name).toBe('attack_special');
  run.time = 1.4; advanceDustAction(boss, run); run.boss.updateBoss(0, run, boss);
  expect(boss.dustAction.name).toBe('summon');
  run.time += 0.8; advanceDustAction(boss, run); expect(run.enemies).toHaveLength(4);
});

it('exported GLB has one rig, embedded materials, 30 FPS clips, seamless loops and a grounded stable death', async () => {
  const bytes = fs.readFileSync(new URL('../public/models/dust.glb', import.meta.url));
  expect(bytes.equals(fs.readFileSync(new URL('../Modelos_Animados/dust/dust.glb', import.meta.url)))).toBe(true);
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  expect(asset.animations.map(c => c.name)).toEqual([...Object.keys(DUST_CLIPS), 'reference_pose']);
  const bones = [], skins = []; asset.scene.traverse(n => { if (n.isBone) bones.push(n); if (n.isSkinnedMesh) skins.push(n); });
  expect(bones).toHaveLength(57); expect(skins).toHaveLength(1);
  expect(asset.scene.getObjectByName('core_socket')).toBeTruthy(); expect(asset.scene.getObjectByName('muzzle_socket')).toBeTruthy();
  for (const clip of asset.animations.filter(c => c.name !== 'reference_pose')) {
    const config = DUST_CLIPS[clip.name]; expect(clip.duration).toBeCloseTo(config.duration, 5);
    for (const track of clip.tracks) {
      expect(track.times).toHaveLength(config.frames + 1);
      for (let i = 0; i < track.times.length; i++) expect(track.times[i]).toBeCloseTo(i / 30, 5);
      expect(Array.from(track.values).every(Number.isFinite)).toBe(true);
      if (config.loop) {
        const size = track.getValueSize(), first = Array.from(track.values.slice(0, size)), last = Array.from(track.values.slice(-size));
        if (size === 4) expect(Math.abs(first.reduce((sum, v, i) => sum + v * last[i], 0))).toBeCloseTo(1, 5);
        else first.forEach((v, i) => expect(last[i]).toBeCloseTo(v, 5));
      }
    }
    const hips = clip.tracks.find(t => t.name === 'mixamorigHips.position');
    for (let i = 0; i < hips.values.length; i += 3) { expect(hips.values[i]).toBe(hips.values[0]); expect(hips.values[i + 2]).toBe(hips.values[2]); }
    expect(clip.tracks.some(t => /^dust(_rig)?\./.test(t.name))).toBe(false);
  }
  const mixer = new THREE.AnimationMixer(asset.scene), death = asset.animations.find(c => c.name === 'death');
  const action = mixer.clipAction(death); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  for (let i = 0; i <= 72; i++) {
    mixer.setTime(i / 30); asset.scene.updateMatrixWorld(true);
    skins.forEach(n => { n.skeleton.update(); n.computeBoundingBox(); });
    expect(new THREE.Box3().setFromObject(asset.scene).min.y).toBeGreaterThan(-0.025);
  }
  for (const track of death.tracks) {
    const size = track.getValueSize();
    Array.from(track.values.slice(-size * 2, -size)).forEach((v, i) => expect(track.values[track.values.length - size + i]).toBeCloseTo(v, 5));
  }
  expect(asset.scene.getObjectByName('core_energy').scale.length()).toBeCloseTo(0);
  mixer.stopAllAction(); mixer.uncacheRoot(asset.scene);
});
