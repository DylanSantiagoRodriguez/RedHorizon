export class AbilitySystem {
  constructor() { this.timer = 0; this.shieldTime = 0; }
  update(dt, run) {
    this.timer = Math.max(0, this.timer - dt);
    if (this.shieldTime > 0) { this.shieldTime -= dt; if (this.shieldTime <= 0) run.player.shield = Math.min(run.player.shield, run.player.stats.shield); }
  }
  activate(run) {
    if (this.timer > 0) return false;
    const p = run.player; this.timer = 14 * p.stats.cooldown; this.shieldTime = 3;
    p.shield = Math.max(p.shield, 30 + p.stats.shield); p.shieldDelay = 6;
    run.combat.explode(p.x, p.y + 1, p.z, 10 * p.stats.area, 60);
    for (const e of run.enemies) if (Math.hypot(e.x - p.x, e.z - p.z) < 10 * p.stats.area) e.stun = e.type === 'titan' ? 0.3 : 1.8;
    run.emit('ability', { playerId: p.id, x: p.x, y: p.y, z: p.z }); return true;
  }
}
