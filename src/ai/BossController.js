import { CONFIG } from '../config.js';
export class BossController {
  constructor() { this.spawned = false; this.enemy = null; this.zones = []; this.nextZone = 1; }
  awaken(run) {
    if (this.spawned) return false;
    const point = run.director.spawnPoint(run, 28, 35); if (!point) return false;
    this.spawned = true; this.enemy = run.spawn('titan', point.x, point.z);
    run.emit('boss', {}); return true;
  }
  update(dt, run) {
    if (!this.spawned && (run.time >= CONFIG.bossTime || run.relays >= 3)) this.awaken(run);
    const boss = this.enemy;
    if (!boss || boss.dead || run.status !== 'playing') return;
    if (boss.phase === 1 && boss.hp <= boss.maxHp * CONFIG.bossPhase) {
      boss.phase = 2; boss.abilityTimer = 0.5; run.emit('phase', {});
    }
    boss.abilityTimer -= dt; boss.summonTimer -= dt;
    if (boss.abilityTimer <= 0) {
      boss.abilityTimer = boss.phase === 2 ? 3.4 : 5.5;
      const count = boss.phase === 2 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const x = run.player.x + (i ? run.random.range(-7, 7) : 0), z = run.player.z + (i ? run.random.range(-7, 7) : 0);
        this.zones.push({ id: this.nextZone++, x, y: run.world.heightAt(x, z), z, radius: 5, remaining: 1.6, duration: 1.6 });
      }
      const shots = boss.phase === 2 ? 14 : 9;
      for (let i = 0; i < shots; i++) {
        const a = i / shots * Math.PI * 2 + run.time * 0.1;
        run.combat.spawn({ x: boss.x, y: boss.y - 1.5, z: boss.z, vx: Math.cos(a) * 13, vy: -0.3, vz: Math.sin(a) * 13, damage: 22, life: 5, radius: 0.4, color: 0xff6143 });
      }
      run.combat.enemyShot(boss);
    }
    if (boss.summonTimer <= 0) {
      boss.summonTimer = boss.phase === 2 ? 10 : 18;
      for (let i = 0; i < (boss.phase === 2 ? 5 : 3); i++) {
        if (run.enemies.filter(e => !e.dead).length >= CONFIG.enemyLimit) break;
        const p = run.director.spawnPoint(run, 16, 25); if (p) run.spawn(i % 2 ? 'stalker' : 'drone', p.x, p.z);
      }
    }
    for (const zone of this.zones) {
      zone.remaining -= dt;
      if (zone.remaining > 0) continue;
      if (Math.hypot(run.player.x - zone.x, run.player.z - zone.z) < zone.radius && run.player.y < zone.y + 1.6) run.hurtPlayer(boss.phase === 2 ? 42 : 32);
      run.emit('explosion', { x: zone.x, y: zone.y, z: zone.z, radius: zone.radius });
    }
    this.zones = this.zones.filter(z => z.remaining > 0);
  }
}
