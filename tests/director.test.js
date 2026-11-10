import { expect, it } from 'vitest';
import { difficultyAt } from '../src/world/DifficultyDirector.js';
import { Run } from '../src/core/Run.js';
import { CONFIG } from '../src/config.js';
const world = { heightAt: () => 0, obstacles: [] };
it('aumenta frecuencia, tamaño de grupo, presión y variedad temporal', () => { const a = difficultyAt(0), b = difficultyAt(300, 10); expect(b.interval).toBeLessThan(a.interval); expect(b.batch).toBeGreaterThan(a.batch); expect(b.tier).toBeGreaterThan(a.tier); expect(b.pressure).toBeGreaterThan(a.pressure); });
it('limita la horda y genera posiciones válidas', () => {
  const run = new Run(world, 'director'); run.time = 250;
  for (let i = 0; i < 100; i++) run.director.update(5, run);
  expect(run.enemies.length).toBe(CONFIG.enemyLimit); expect(new Set(run.enemies.map(e => e.type)).size).toBe(6);
  expect(run.enemies.every(e => Math.hypot(e.x, e.z) >= 24)).toBe(true);
});
it('derrota y reinicio limpian la simulación', () => {
  const run = new Run(world, 'reset'); run.hurtPlayer(1000); expect(run.status).toBe('defeat');
  const fresh = new Run(world, 'reset'); expect(fresh.status).toBe('playing'); expect(fresh.player.hp).toBe(120); expect(fresh.enemies).toHaveLength(5); expect(fresh.time).toBe(0); expect(fresh.combat.pool.items.every(p => !p.active)).toBe(true);
});
