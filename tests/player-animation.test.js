import { it, expect } from 'vitest';
import { movementWeights, avatarState } from '../src/graphics/PlayerAnimationState.js';
import { Run } from '../src/core/Run.js';
const make = () => new Run({ heightAt: () => 0, obstacles: [] }, 'animated');

it('mezcla diagonales y retroceso sin cambiar la orientación del jugador', () => {
  const p = make().player; p.yaw = Math.PI;
  p.vz = 7; expect(movementWeights(p).walk_backward).toBeCloseTo(1);
  p.vz = -7 / Math.SQRT2; p.vx = 7 / Math.SQRT2;
  const weights = movementWeights(p);
  expect(weights.walk_forward).toBeCloseTo(0.5); expect(weights.strafe_left).toBeCloseTo(0.5);
  expect(Object.values(weights).reduce((sum, v) => sum + v, 0)).toBeCloseTo(1);
  p.vx = 0; p.vz = -10.5; expect(movementWeights(p).run_forward).toBeCloseTo(1);
  expect(p.yaw).toBe(Math.PI);
});
it('prioriza salto, deslizamiento, muerte y desenlace', () => {
  const r = make(); expect(avatarState(r)).toBe('locomotion');
  r.player.grounded = false; expect(avatarState(r)).toBe('jump');
  r.player.slideTime = 0.5; expect(avatarState(r)).toBe('slide');
  r.player.dead = true; expect(avatarState(r)).toBe('death');
  r.mission.phase = 'cinematic'; expect(avatarState(r)).toBe('final_collapse');
});
it('no dispara ni emite eventos durante el deslizamiento y reanuda al salir', () => {
  const r = make(), direction = { x: 0, y: 0, z: -1 }; r.autoFire = true; r.player.slideTime = 0.8;
  for (const weapon of ['plasma', 'scatter', 'nova']) {
    r.weapon.equipped = weapon; expect(r.weapon.fire(r, direction)).toBe(false);
  }
  expect(r.weapon.shotId).toBe(0); expect(r.weapon.timer).toBe(0);
  expect(r.combat.pool.items.some(p => p.active)).toBe(false);
  r.player.slideTime = 0; expect(r.weapon.fire(r, direction)).toBe(true);
});
