import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Models } from '../src/graphics/Models.js';
import { WeaponModels } from '../src/graphics/WeaponModels.js';
import { Run } from '../src/core/Run.js';

describe('weapon presentation', () => {
  it('switches models, aims vertically and emits one muzzle burst per shot', () => {
    const models = new Models(), mount = new THREE.Group(), views = new WeaponModels(models, mount);
    const run = new Run({ heightAt: () => 0, obstacles: [] }, 'visuals');
    let bursts = 0;
    for (const kind of ['plasma', 'scatter', 'nova']) {
      run.weapon.equipped = kind; run.weapon.timer = 0;
      run.weapon.fire(run, { x: 0, y: 1, z: 0 });
      views.update(run, () => bursts++); views.update(run, () => bursts++);
      expect(Object.values(views.variants).filter(v => v.root.visible)).toHaveLength(1);
      expect(views.variants[kind].root.visible).toBe(true);
      expect(views.variants[kind].flash.visible).toBe(true);
      const forward = new THREE.Vector3(); mount.getWorldDirection(forward);
      expect(forward.y).toBeCloseTo(1);
      run.time += 1; views.update(run);
      expect(views.variants[kind].flash.visible).toBe(false);
    }
    expect(bursts).toBe(3); models.dispose();
  });
  it('clears weapon styling when the pool reuses a projectile for an enemy', () => {
    const run = new Run({ heightAt: () => 0, obstacles: [] }, 'reuse');
    run.weapon.fire(run, { x: 0, y: 0, z: -1 });
    const projectile = run.combat.pool.items.find(p => p.active);
    expect(projectile.kind).toBe('plasma'); run.combat.pool.clear();
    run.combat.spawn({ x: 0, y: 0, z: 0 });
    expect(run.combat.pool.items.find(p => p.active).kind).toBe(null);
  });
});
