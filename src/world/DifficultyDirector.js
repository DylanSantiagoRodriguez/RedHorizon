import { CONFIG } from '../config.js';
export function difficultyAt(time, level = 1) {
  const tier = Math.min(5, Math.floor(time / 65));
  return { tier, damageMultiplier: 1 + Math.min(2, Math.max(0, time) / 600 + Math.max(0, level - 1) * 0.025), pressure: 1 + time / 160 + (level - 1) * 0.035, interval: Math.max(0.55, 2.5 - time / 200), batch: 1 + Math.floor(time / 100), scale: 1 + time / 500, label: ['SEÑAL DÉBIL', 'CONTACTO', 'HOSTIL', 'ASEDIO', 'CRÍTICA', 'CATACLISMO'][tier] };
}
export class DifficultyDirector {
  constructor() { this.timer = 2; this.wave = 0; }
  update(dt, run) {
    this.timer -= dt; if (this.timer > 0) return;
    const d = difficultyAt(run.time, run.level || 1); this.timer = d.interval / (1 + ((run.level || 1) - 1) * 0.015); this.wave++;
    const types = ['stalker'];
    if (run.time > 22) types.push('brute');
    if (run.time > 40) types.push('spitter');
    if (run.time > 65) types.push('drone');
    if (run.time > 120) types.push('elite');
    for (let i = 0; i < Math.min(5, d.batch); i++) {
      if (run.enemies.filter(e => !e.dead).length >= CONFIG.enemyLimit - (5 - (run.boss?.guardians.length || 0))) break;
      const point = this.spawnPoint(run); if (point) run.spawn(run.random.pick(types), point.x, point.z, d.scale);
    }
  }
  spawnPoint(run, min = 24, max = 36) {
    for (let i = 0; i < 40; i++) {
      const a = run.random.range(0, Math.PI * 2), r = run.random.range(min, max);
      const origin = run.spawnOrigin?.() || run.player;
      const x = origin.x + Math.cos(a) * r, z = origin.z + Math.sin(a) * r;
      if (run.livingPlayers?.().some(p => Math.hypot(p.x - x, p.z - z) < Math.min(min, 12))) continue;
      if (Math.hypot(x, z) > CONFIG.mapRadius - 5) continue;
      if (run.world.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 3.5)) continue;
      return { x, z };
    }
    return null;
  }
}
