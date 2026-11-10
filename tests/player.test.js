import { expect, it } from 'vitest';
import { Player } from '../src/entities/Player.js';
import { moveCircle, segmentHit } from '../src/physics/CollisionSystem.js';
const world = { heightAt: () => 0, obstacles: [] };
it('salta, rechaza salto aéreo y aterriza', () => {
  const p = new Player(); const input = { down: () => false, take: () => true, buttons: new Set() };
  p.update(1 / 60, input, 0, world); expect(p.grounded).toBe(false);
  for (let i = 0; i < 20; i++) p.update(1 / 60, input, 0, world);
  expect(p.vy).toBeLessThan(2);
  input.take = () => false;
  for (let i = 0; i < 100; i++) p.update(1 / 60, input, 0, world);
  expect(p.y).toBe(0); expect(p.grounded).toBe(true);
});
it('resuelve obstáculos y evita atravesarlos', () => { const p = { x: 0, z: 0, radius: 0.5 }; moveCircle(p, 1, 0, [{ x: 1, z: 0, radius: 1 }]); expect(Math.hypot(p.x - 1, p.z)).toBeGreaterThanOrEqual(1.5); });
it('detecta impactos barridos aunque el proyectil cruce el objetivo', () => { expect(segmentHit(0, 0, 0, 20, 0, 0, 10, 0, 0, 1)).toBe(true); });
it('aplica invulnerabilidad, escudo y muerte', () => { const p = new Player(); p.shield = 20; p.hurt(30); expect(p.hp).toBe(110); p.hurt(1000); expect(p.dead).toBe(false); p.invulnerable = 0; p.hurt(1000); expect(p.dead).toBe(true); expect(p.hp).toBe(0); });

it.each([0, Math.PI / 2, -1.2])('mantiene la orientación del ratón al caminar, retroceder y desplazarse lateralmente (yaw %s)', yaw => {
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD', null]) {
    const p = new Player(), input = { down: k => k === key, take: () => false, buttons: new Set() };
    p.update(0.1, input, yaw, world);
    expect(p.yaw).toBeCloseTo(Math.PI - yaw);
    const forward = p.vx * Math.sin(yaw) - p.vz * Math.cos(yaw);
    const right = p.vx * Math.cos(yaw) + p.vz * Math.sin(yaw);
    if (key === 'KeyS') expect(forward).toBeLessThan(0);
    if (key === 'KeyW') expect(forward).toBeGreaterThan(0);
    if (key === 'KeyA') { expect(right).toBeLessThan(0); expect(forward).toBeCloseTo(0); }
    if (key === 'KeyD') { expect(right).toBeGreaterThan(0); expect(forward).toBeCloseTo(0); }
  }
});

it('bunnyhop conserva impulso y gana velocidad sin cambiar estadísticas', () => {
  const p = new Player(); const keys = new Set(['KeyW', 'ShiftLeft']);
  const input = { down: key => keys.has(key), take: () => false, buttons: new Set() };
  for (let i = 0; i < 60; i++) p.update(1 / 60, input, 0, world);
  const initial = Math.hypot(p.vx, p.vz); keys.add('Space');
  for (let i = 0; i < 210; i++) p.update(1 / 60, input, 0, world);
  expect(p.hopChain).toBeGreaterThan(1); expect(Math.hypot(p.vx, p.vz)).toBeGreaterThan(initial + 2);
  expect(Math.hypot(p.vx, p.vz)).toBeLessThanOrEqual(18.01); expect(p.stats.speed).toBe(1);
  keys.delete('Space');
  for (let i = 0; i < 120; i++) p.update(1 / 60, input, 0, world);
  expect(p.hopChain).toBe(0); expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(10.5, 1);
});
it('deslizamiento exige velocidad, tiene enfriamiento y se cancela con salto', () => {
  const p = new Player(); let pressed = 'ControlLeft';
  const input = { down: () => false, take: key => { if (key !== pressed) return false; pressed = ''; return true; }, buttons: new Set() };
  p.update(1 / 60, input, 0, world); expect(p.slideTime).toBe(0);
  p.vz = -10; pressed = 'ControlLeft'; p.update(1 / 60, input, 0, world);
  expect(p.slideTime).toBeGreaterThan(0); expect(p.slideCooldown).toBeGreaterThan(0);
  pressed = 'Space'; p.update(1 / 60, input, 0, world);
  expect(p.slideTime).toBe(0); expect(p.grounded).toBe(false);
});
