import { expect, it } from 'vitest';
import { Run } from '../src/core/Run.js';
const input = { take: () => false, down: () => false, buttons: new Set() };
const aim = { x: 0, y: 0, z: -1 };
const create = () => new Run({ heightAt: () => 0, obstacles: [], beacons: [], rewards: [] }, 'last-light');
function prepare(run) {
  for (const altar of run.altars) { run.player.x = altar.x; run.player.z = altar.z; run.boss.awaken(run, altar); }
  for (const boss of run.boss.guardians) run.combat.hit(boss, 100000);
  for (const gem of run.gems) gem.collected = true;
  run.player.x = 0; run.player.z = 7; run.update(0, input, 0, aim);
}
it('requiere las cinco gemas y una interacción para lanzar una sola vez', () => {
  const r = create(); r.interaction = r.launchBeacon;
  expect(r.interact()).toBe(false); expect(r.launchBeacon.used).toBe(false);
  prepare(r); expect(r.mission.phase).toBe('ready'); expect(r.status).toBe('playing');
  expect(r.interact()).toBe(true); expect(r.interact()).toBe(false);
  expect(r.mission.countdown).toBe(60);
});
it('pausa el reloj, extingue toda vida y termina tras la cinemática', () => {
  const r = create(); prepare(r); r.interact();
  r.status = 'paused'; r.update(20, input, 0, aim); expect(r.mission.countdown).toBe(60);
  r.status = 'playing'; r.update(60, input, 0, aim);
  expect(r.player.dead).toBe(true); expect(r.enemies.every(e => e.dead)).toBe(true);
  expect(r.mission.phase).toBe('cinematic'); expect(r.status).toBe('playing');
  r.update(23, input, 0, aim); expect(r.status).toBe('playing');
  r.update(1, input, 0, aim); expect(r.status).toBe('victory');
  const fresh = create(); expect(fresh.mission.phase).toBe('collect'); expect(fresh.launchBeacon.used).toBe(false);
});
it('morir antes del lanzamiento fracasa; después no cancela la señal ni adelanta el reloj', () => {
  const r = create(); r.hurtPlayer(10000); expect(r.status).toBe('defeat');
  const launched = create(); prepare(launched); launched.interact(); launched.hurtPlayer(10000);
  expect(launched.status).toBe('playing'); expect(launched.mission.countdown).toBe(60);
  launched.update(60, input, 0, aim); expect(launched.mission.phase).toBe('cinematic');
});
