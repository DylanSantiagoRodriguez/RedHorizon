import { WEAPONS } from '../data/weapons.js';
export class WeaponSystem {
  constructor() { this.equipped = 'plasma'; this.timer = 0; this.recoil = 0; }
  update(dt) { this.timer = Math.max(0, this.timer - dt); this.recoil = Math.max(0, this.recoil - dt * 5); }
  fire(run, direction) {
    if (this.timer > 0) return false;
    const w = WEAPONS[this.equipped], p = run.player;
    this.timer = w.interval / p.stats.fireRate; this.recoil = 1;
    const count = w.pellets + p.stats.multishot;
    for (let i = 0; i < count; i++) {
      const spread = w.spread + (p.stats.multishot ? 0.02 : 0);
      const dx = direction.x + run.random.range(-spread, spread), dy = direction.y + run.random.range(-spread, spread), dz = direction.z + run.random.range(-spread, spread), n = Math.hypot(dx, dy, dz);
      run.combat.spawn({ x: p.x, y: p.y + 1.45, z: p.z, vx: dx / n * w.speed, vy: dy / n * w.speed, vz: dz / n * w.speed, damage: w.damage, life: w.range / w.speed, radius: w.radius, blast: w.blast, color: w.color, friendly: true, pierce: p.stats.pierce, bounce: p.stats.bounce });
    }
    run.emit('shot', { kind: this.equipped }); return true;
  }
}
