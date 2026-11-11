import { it, expect } from 'vitest';
import { Run } from '../src/core/Run.js';
import { advanceDustAction } from '../src/ai/DustActions.js';
import { DUST_CLIPS } from '../src/data/dustAnimations.js';
const world = () => ({ heightAt: () => 0, obstacles: [], beacons: [{ x: 0, z: 0, type: 'relay', used: false }], rewards: [] });
it('pulso causa daño, aturde, protege y respeta enfriamiento', () => {
  const run = new Run(world(), 'pulse'); const e = run.spawn('brute', 2, 0); expect(run.ability.activate(run)).toBe(true);
  expect(e.hp).toBeLessThan(e.maxHp); expect(e.stun).toBeGreaterThan(0); expect(run.player.shield).toBe(30); expect(run.ability.activate(run)).toBe(false);
  run.ability.update(15, run); expect(run.player.shield).toBe(0); expect(run.ability.timer).toBe(0);
});
it('relé se consume una sola vez y recompensa', () => { const run = new Run(world(), 'relay'); run.interaction = run.world.beacons[0]; expect(run.interact()).toBe(true); expect(run.interact()).toBe(false); expect(run.relays).toBe(1); expect(run.salvage).toBe(15); });
it('jefe tiene dos fases, anticipa áreas, invoca y concede victoria', () => {
  const run = new Run(world(), 'boss'); for (const altar of run.altars) { run.player.x = altar.x; run.player.z = altar.z; run.boss.awaken(run, altar); } run.time = 360; run.boss.update(0.1, run); const boss = run.boss.enemy; expect(boss.type).toBe('titan');
  boss.hp = boss.maxHp * 0.4; run.boss.update(0.1, run); expect(boss.phase).toBe(2);
  run.boss.update(1, run);
  expect(run.boss.zones).toHaveLength(0);
  run.time += DUST_CLIPS.attack_special.eventFrame / 30; advanceDustAction(boss, run);
  expect(run.boss.zones.length).toBe(3); expect(run.boss.zones[0].remaining).toBeGreaterThan(0);
  run.time += DUST_CLIPS.attack_special.duration; advanceDustAction(boss, run);
  boss.summonTimer = 0; run.boss.updateBoss(0.1, run, boss);
  run.time += DUST_CLIPS.summon.eventFrame / 30; advanceDustAction(boss, run);
  expect(run.enemies.length).toBe(10);
  run.combat.hit(boss, 100000); expect(run.status).toBe('playing');
  for (const guardian of run.boss.guardians) run.combat.hit(guardian, 100000);
  expect(run.status).toBe('playing');
  expect(run.gems).toHaveLength(5); expect(new Set(run.gems.map(g => g.color)).size).toBe(5);
  run.onKill(boss); expect(run.gems).toHaveLength(5);
  for (const gem of run.gems) {
    run.player.x = gem.x; run.player.z = gem.z;
    run.update(0, { take: () => false, buttons: new Set(), down: () => false }, 0, { x: 0, y: 0, z: -1 });
  }
  expect(run.status).toBe('playing'); expect(run.mission.phase).toBe('ready');
});
it('las tres armas generan sus proyectiles', () => {
  const run = new Run(world(), 'weapons');
  for (const [type, count] of [['plasma', 1], ['scatter', 6], ['nova', 1]]) {
    run.combat.pool.clear(); run.weapon.equipped = type; run.weapon.timer = 0; run.weapon.fire(run, { x: 0, y: 0, z: -1 });
    expect(run.combat.pool.items.filter(p => p.active).length).toBe(count);
  }
});
it('una victoria es terminal aunque quede daño enemigo en el mismo tick', () => {
  const run = new Run(world(), 'terminal'); run.status = 'victory'; run.hurtPlayer(10000); expect(run.status).toBe('victory'); expect(run.player.hp).toBe(120);
});

it('recoge gemas al acercarse y reinicia su inventario', () => {
  const run = new Run(world(), 'gems');
  for (const altar of run.altars) { run.player.x = altar.x; run.player.z = altar.z; run.boss.awaken(run, altar); }
  const boss = run.boss.guardians[0]; run.combat.hit(boss, 100000);
  expect(run.gems[0].collected).toBe(false);
  run.player.x = boss.x; run.player.z = boss.z;
  run.update(0, { take: () => false, buttons: new Set(), down: () => false }, 0, { x: 0, y: 0, z: -1 });
  expect(run.gems[0].collected).toBe(true);
  expect(new Run(world(), 'gems').gems).toHaveLength(0);
});
