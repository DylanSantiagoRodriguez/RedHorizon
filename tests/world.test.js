import { expect, it } from 'vitest';
import { TerrainGenerator } from '../src/world/TerrainGenerator.js';
it('genera terreno y obstáculos deterministas y distintos entre semillas', () => {
  const a = new TerrainGenerator('a'), b = new TerrainGenerator('a'), c = new TerrainGenerator('b');
  expect(a.heights).toEqual(b.heights); expect(a.rocks).toEqual(b.rocks); expect(a.heights).not.toEqual(c.heights);
});
it('mantiene el inicio libre y distancias transitables entre rocas', () => {
  const world = new TerrainGenerator('QA');
  for (const a of world.rocks) {
    expect(Math.hypot(a.x, a.z)).toBeGreaterThan(10);
    for (const b of world.rocks) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius + 2.9);
  }
  expect(world.heightAt(0, 0)).toBeCloseTo(0);
  expect(Number.isFinite(world.heightAt(999, -999))).toBe(true);
});
