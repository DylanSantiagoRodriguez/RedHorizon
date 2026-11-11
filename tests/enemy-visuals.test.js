import { expect, it } from 'vitest';
import * as THREE from 'three';
import { GUARDIANS, enemyModelKey } from '../src/data/guardians.js';
import { Models } from '../src/graphics/Models.js';
import { createEnemy } from '../src/entities/Enemy.js';
import { Run } from '../src/core/Run.js';
import { animateGuardian } from '../src/graphics/EnemyModels.js';
import { advanceDustAction } from '../src/ai/DustActions.js';
import { DUST_CLIPS } from '../src/data/dustAnimations.js';

it('invoca cinco identidades y conserva su color en proyectiles, áreas y efectos', () => {
  const events = [], run = new Run({ heightAt: () => 0, obstacles: [] }, 'guardians', (type, data) => events.push({ type, data }));
  for (const altar of run.altars) {
    run.player.x = altar.x; run.player.z = altar.z; expect(run.boss.awaken(run, altar)).toBe(true);
    const boss = run.boss.enemy; boss.abilityTimer = 0;
    run.boss.updateBoss(0.01, run, boss);
    if (boss.guardianId === 'dust') { run.time += DUST_CLIPS.attack_special.eventFrame / 30; advanceDustAction(boss, run); }
    expect(run.boss.zones.at(-1).color).toBe(altar.color);
    expect(run.combat.pool.items.filter(p => p.active).at(-1).color).toBe(altar.color);
  }
  expect(new Set(run.boss.guardians.map(enemyModelKey)).size).toBe(5);
  expect(events.filter(e => e.type === 'guardianEffect').map(e => e.data.guardianId)).toEqual(GUARDIANS.map(g => g.id));
});

it('reutiliza las geometrías sin compartir las transformaciones de efectos entre jefes', () => {
  const models = new Models(), signatures = [];
  for (const profile of GUARDIANS) {
    const enemy = { ...createEnemy(1, 'titan', 0, 0), guardianId: profile.id, lastAbilityAt: 1 };
    const a = models.enemy(enemy), b = models.enemy(enemy);
    expect(a.children[0].geometry).toBe(b.children[0].geometry);
    const fx = a.getObjectByName('guardian-effects');
    expect(fx).not.toBe(b.getObjectByName('guardian-effects'));
    animateGuardian(a, enemy, 1.2); a.updateMatrixWorld(true);
    expect(fx.children[0].scale.x).toBeGreaterThan(1);
    expect(b.getObjectByName('guardian-effects').children[0].scale.x).toBe(1);
    const bounds = new THREE.Box3().setFromObject(a);
    expect(Number.isFinite(bounds.max.y)).toBe(true);
    signatures.push(a.children[0].geometry.attributes.position.count);
  }
  expect(new Set(signatures).size).toBe(5);
  const count = models.geometries.size;
  for (const profile of GUARDIANS) models.enemy({ ...createEnemy(2, 'titan', 0, 0), guardianId: profile.id });
  expect(models.geometries.size).toBe(count);
  for (const type of ['stalker', 'spitter', 'elite', 'drone', 'brute']) expect(models.enemy(createEnemy(3, type, 0, 0)).children).toHaveLength(2);
  models.dispose();
});
