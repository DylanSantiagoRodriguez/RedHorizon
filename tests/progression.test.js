import { it, expect } from 'vitest';
import { ExperienceSystem } from '../src/progression/ExperienceSystem.js';
import { UpgradeSystem } from '../src/progression/UpgradeSystem.js';
import { Player } from '../src/entities/Player.js';
import { Random } from '../src/utils/Random.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { Run } from '../src/core/Run.js';
it('conserva excedentes y encola múltiples niveles', () => { const xp = new ExperienceSystem(); expect(xp.add(100)).toBe(2); expect(xp.level).toBe(3); expect(xp.xp).toBe(21); expect(xp.pending).toBe(2); });
it('ofrece tres mejoras distintas y aplica solamente ofertas válidas', () => {
  const u = new UpgradeSystem(), p = new Player(); u.roll(new Random('a')); expect(new Set(u.offers.map(o => o.id)).size).toBe(3);
  expect(u.apply('invalid', p)).toBe(false); const chosen = u.offers[0]; expect(u.apply(chosen.id, p)).toBe(true); expect(u.stacks[chosen.id]).toBe(1); expect(u.apply(chosen.id, p)).toBe(false);
});
it('aplica las 15 mejoras con límites finitos', () => {
  const u = new UpgradeSystem(), p = new Player();
  for (const upgrade of UPGRADES) { for (let i = 0; i < upgrade.max; i++) expect(u.apply(upgrade.id, p, false)).toBe(true); expect(u.apply(upgrade.id, p, false)).toBe(false); }
  expect(p.stats.cooldown).toBeGreaterThan(0); expect(p.stats.crit).toBeLessThan(1); expect(u.roll(new Random('x'))).toHaveLength(0);
});
it('pausa niveles pendientes y reanuda tras cada elección', () => {
  const run = new Run({ heightAt: () => 0, obstacles: [] }, 'level'); run.experience.add(100); run.checkLevel(); expect(run.status).toBe('upgrade');
  run.chooseUpgrade(run.upgrades.offers[0].id); expect(run.status).toBe('upgrade');
  run.chooseUpgrade(run.upgrades.offers[0].id); expect(run.status).toBe('playing'); expect(run.experience.pending).toBe(0);
});
