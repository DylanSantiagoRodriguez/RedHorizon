import { it, expect } from 'vitest';
import { calculateDamage, damageEntity } from '../src/combat/DamageSystem.js';
import { baseStats } from '../src/entities/Player.js';
import { Run } from '../src/core/Run.js';
const world = { heightAt: () => 0, obstacles: [] };
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
