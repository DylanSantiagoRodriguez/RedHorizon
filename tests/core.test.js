import { describe, it, expect } from 'vitest';
import { Random } from '../src/utils/Random.js';
import { StateManager } from '../src/core/StateManager.js';
import { GameLoop } from '../src/core/GameLoop.js';
describe('base técnica', () => {
  it('reproduce la semilla', () => { const a = new Random('mars'), b = new Random('mars'); expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next())); });
  it('rechaza transiciones inválidas', () => { const state = new StateManager(); expect(state.set('victory')).toBe(false); expect(state.set('playing')).toBe(true); expect(state.set('paused')).toBe(true); });
  it('limita la recuperación de un frame lento', () => { let ticks = 0; const loop = new GameLoop(() => ticks++, () => {}); loop.frame(0); loop.frame(5000); expect(ticks).toBeLessThanOrEqual(6); expect(ticks).toBeGreaterThan(0); });
});
