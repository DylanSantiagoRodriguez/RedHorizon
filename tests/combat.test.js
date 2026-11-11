import { it, expect } from 'vitest';
import { calculateDamage, damageEntity } from '../src/combat/DamageSystem.js';
import { baseStats } from '../src/entities/Player.js';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { difficultyAt } from '../src/world/DifficultyDirector.js';
const world = { heightAt: () => 0, obstacles: [] };
it('escala el daño recibido con tiempo y nivel y comunica las pérdidas reales', () => {
  const events = [], run = new Run(world, 'scaled', (type, data) => { if (type === 'hurt') events.push(data); });
  run.hurtPlayer(10); expect(run.player.hp).toBe(110);
  run.time = 600; run.hurtPlayer(10); expect(run.player.hp).toBe(90);
  run.experience.level = 5; run.player.shield = 8; run.hurtPlayer(10);
  expect(run.player.hp).toBeCloseTo(77);
  expect(events.at(-1)).toEqual({ healthDamage: 13, shieldDamage: 8 });
});
it('suma ataques cuerpo a cuerpo de dos enemigos en la misma actualización', () => {
  const run = new Run(world, 'combined-melee');
  const a = run.spawn('stalker', 0, 1), b = run.spawn('brute', 0, -1);
  a.attackTimer = 0; b.attackTimer = 0;
  updateEnemy(b, 1 / 60, run); // Brute starts .2 s before stalker so contacts coincide.
  expect(run.player.hp).toBe(120);
  run.time = .2; updateEnemy(a, 1 / 60, run);
  run.time = 18 / 30;
  updateEnemy(a, 1 / 60, run); updateEnemy(b, 1 / 60, run);
  expect(run.player.hp).toBeCloseTo(120 - (a.damage + b.damage) * difficultyAt(run.time, run.level).damageMultiplier);
});
it('suma proyectiles simultáneos y consume cada impacto una sola vez', () => {
  const run = new Run(world, 'combined-projectiles');
  for (const damage of [12, 16, 22]) run.combat.spawn({ x: 0, y: 1, z: 0.5, vx: 0, vy: 0, vz: -10, damage, life: 2 });
  run.combat.update(1 / 60);
  expect(run.player.hp).toBe(70);
  run.combat.update(1 / 60); expect(run.player.hp).toBe(70);
  expect(run.combat.pool.items.filter(p => p.active)).toHaveLength(0);
});
it('calcula críticos y daño escalado', () => { const stats = { ...baseStats(), damage: 2, crit: 0.5, critDamage: 2.5 }; expect(calculateDamage(10, stats, 0).amount).toBe(50); expect(calculateDamage(10, stats, 0.8).amount).toBe(20); });
it('mata una sola vez', () => { const enemy = { hp: 10, dead: false }; expect(damageEntity(enemy, 20)).toBe(true); expect(damageEntity(enemy, 20)).toBe(false); expect(enemy.hp).toBe(0); });
it('respeta enfriamiento y produce impactos reales', () => {
  const run = new Run(world, 'test'); const enemy = run.spawn('stalker', 0, -6); enemy.y = 1.45;
  expect(run.weapon.fire(run, { x: 0, y: 0, z: -1 })).toBe(true); expect(run.weapon.fire(run, { x: 0, y: 0, z: -1 })).toBe(false);
  for (let i = 0; i < 12; i++) run.combat.update(1 / 60);
  expect(enemy.hp).toBeLessThan(enemy.maxHp); run.weapon.update(1); expect(run.weapon.timer).toBe(0);
});
it('robo de vida usa daño efectivo y no exceso al matar', () => { const run = new Run(world, 'leech'); run.player.hp = 50; run.player.stats.lifesteal = 0.1; run.player.stats.crit = 0; const e = run.spawn('stalker', 0, -5); e.hp = 10; run.combat.hit(e, 1000); expect(run.player.hp).toBe(51); });
it('el explosivo aplica una sola instancia de daño por impacto', () => {
  const run = new Run(world, 'nova'); run.player.stats.crit = 0; const e = run.spawn('brute', 0, -6); e.y = 1.45;
  run.weapon.equipped = 'nova'; run.weapon.fire(run, { x: 0, y: 0, z: -1 }); for (let i = 0; i < 30; i++) run.combat.update(1 / 60);
  expect(e.hp).toBe(e.maxHp - 62);
});
