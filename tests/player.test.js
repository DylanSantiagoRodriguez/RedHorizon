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
