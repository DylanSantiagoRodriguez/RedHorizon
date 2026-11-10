import { CONFIG } from '../config.js';
export class BossController {
  constructor() { this.spawned = false; this.enemy = null; this.guardians = []; this.zones = []; this.nextZone = 1; }
  awaken(run) {
    if (this.spawned) return false;
    this.spawned = true;
    const colors = [0xff5060, 0x509dff, 0x50e090, 0xb580ff, 0xffd050];
    const names = ['Guardián rubí', 'Guardián zafiro', 'Guardián esmeralda', 'Guardián amatista', 'Titán del polvo'];
    for (let i = 0; i < 5; i++) {
      let x = Math.sin(i * Math.PI * 2 / 5) * 82, z = -Math.cos(i * Math.PI * 2 / 5) * 82;
      for (let j = 0; j < 100; j++) {
        if (!run.world.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 4)) break;
        x = Math.sin(i * Math.PI * 2 / 5 + j * 0.015) * 95;
        z = -Math.cos(i * Math.PI * 2 / 5 + j * 0.015) * 95;
      }
      const boss = run.spawn('titan', x, z, i < 4 ? 0.35 : 1);
      Object.assign(boss, { name: names[i], gemColor: colors[i], active: false });
      this.guardians.push(boss);
    }
    this.enemy = this.guardians[4];
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
  }
}
