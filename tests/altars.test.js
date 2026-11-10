import { it, expect } from 'vitest';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
const create = () => new Run({ heightAt: () => 0, obstacles: [] }, 'altars');
it('no crea jefes al iniciar, por tiempo ni al conectar relés', () => {
  const r = create(); expect(r.altars).toHaveLength(5); expect(r.enemies).toHaveLength(0);
  r.time = 1000; r.relays = 3; r.boss.update(1, r);
  expect(r.boss.guardians).toHaveLength(0);
});
it('cada altar invoca solo una vez y exige proximidad', () => {
  const r = create(), a = r.altars[0]; r.interaction = a;
  expect(r.interact()).toBe(false);
  r.player.x = a.x; r.player.z = a.z;
  expect(r.interact()).toBe(true); expect(r.interact()).toBe(false);
  expect(r.boss.guardians).toHaveLength(1); expect(r.altars.filter(a => a.used)).toHaveLength(1);
  const b = r.boss.enemy, before = Math.hypot(b.x - r.player.x, b.z - r.player.z);
  updateEnemy(b, 0.5, r);
  expect(Math.hypot(b.x - r.player.x, b.z - r.player.z)).toBeLessThan(before);
});
it('actualiza las habilidades de varios jefes y consume sus áreas de daño', () => {
  const r = create();
  for (const a of r.altars.slice(0, 2)) { r.player.x = a.x; r.player.z = a.z; r.boss.awaken(r, a); }
  for (const b of r.boss.guardians) b.abilityTimer = 0;
  r.boss.update(0.1, r); expect(r.boss.zones).toHaveLength(2);
  r.boss.update(1.6, r); expect(r.boss.zones).toHaveLength(0);
});
