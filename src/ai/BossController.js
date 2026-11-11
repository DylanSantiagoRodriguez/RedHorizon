import { GUARDIANS } from '../data/guardians.js';
import { CONFIG } from '../config.js';
import { isDust } from '../data/dustAnimations.js';
import { startDustAction } from './DustActions.js';
export class BossController {
  constructor() { this.spawned = false; this.enemy = null; this.guardians = []; this.zones = []; this.nextZone = 1; }
  prepareAltars(run) {
    return GUARDIANS.map(({ color, name }, i) => {
      // Search each sector for an arena large enough for the altar and summon.
      for (let j = 0; j < 400; j++) {
        const angle = i * Math.PI * 2 / 5 + (j % 40 - 20) * 0.015;
        const radius = 65 + Math.floor(j / 40) * 3;
        const x = Math.sin(angle) * radius, z = -Math.cos(angle) * radius;
        if (run.world.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 10)) continue;
        return { x, z, color, name, index: i, type: 'altar', used: false };
      }
      // A clear spawn is required; never summon inside an obstacle.
      const point = run.director.spawnPoint(run, 45, 95);
      return { ...(point || { x: 0, z: 0 }), color, name, index: i, type: 'altar', used: false };
    });
  }
  awaken(run, altar) {
    if (!altar || altar.used || !run.altars.includes(altar)) return false;
    if (Math.hypot(run.player.x - altar.x, run.player.z - altar.z) >= 3.5) return false;
    let point = null;
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16, x = altar.x + Math.cos(angle) * 7, z = altar.z + Math.sin(angle) * 7;
      if (Math.hypot(x, z) > CONFIG.mapRadius - 4 || run.world.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 3.5)) continue;
      point = { x, z }; break;
    }
    if (!point) return false;
    const boss = run.spawn('titan', point.x, point.z, altar.index < 4 ? 0.35 : 1);
    Object.assign(boss, { name: altar.name, gemColor: altar.color, guardianId: GUARDIANS[altar.index].id, color: altar.color, active: true });
    altar.used = true; this.spawned = true; this.guardians.push(boss); this.enemy = boss;
    run.emit('boss', { name: boss.name }); return true;
  }
  update(dt, run) {
    if (run.status !== 'playing') return;
    for (const boss of this.guardians) if (!boss.dead) this.updateBoss(dt, run, boss);
    this.enemy = this.guardians.filter(b => !b.dead).sort((a, b) => Math.hypot(a.x - run.player.x, a.z - run.player.z) - Math.hypot(b.x - run.player.x, b.z - run.player.z))[0] || null;
    for (const zone of this.zones) {
      zone.remaining -= dt;
      if (zone.remaining > 0) continue;
      if (Math.hypot(run.player.x - zone.x, run.player.z - zone.z) < zone.radius && run.player.y < zone.y + 1.6) run.hurtPlayer(zone.damage);
      run.emit('explosion', { x: zone.x, y: zone.y, z: zone.z, radius: zone.radius, color: zone.color });
      run.emit('guardianEffect', { x: zone.x, y: zone.y + 0.2, z: zone.z, guardianId: zone.guardianId, color: zone.color });
    }
    this.zones = this.zones.filter(zone => zone.remaining > 0);
  }
  updateBoss(dt, run, boss) {
    if (boss.phase === 1 && boss.hp <= boss.maxHp * CONFIG.bossPhase) {
      boss.phase = 2; boss.abilityTimer = 0.5; run.emit('phase', {});
    }
    boss.abilityTimer -= dt; boss.summonTimer -= dt;
    if (isDust(boss) && (boss.stun > 0 || boss.dustAction)) return;
    if (boss.abilityTimer <= 0) {
      boss.abilityTimer = boss.phase === 2 ? 3.4 : 5.5;
      if (isDust(boss)) { startDustAction(boss, 'attack_special', run.time); return; }
      this.releaseAbility(run, boss);
    }
    if (boss.summonTimer <= 0) {
      boss.summonTimer = boss.phase === 2 ? 10 : 18;
      if (isDust(boss)) { startDustAction(boss, 'summon', run.time); return; }
      this.releaseSummon(run, boss);
    }
  }
  releaseAbility(run, boss) {
      boss.lastAbilityAt = run.time;
      run.emit('guardianEffect', { x: boss.x, y: boss.y, z: boss.z, guardianId: boss.guardianId, color: boss.gemColor });
      const count = boss.phase === 2 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const x = run.player.x + (i ? run.random.range(-7, 7) : 0), z = run.player.z + (i ? run.random.range(-7, 7) : 0);
        this.zones.push({ id: this.nextZone++, x, y: run.world.heightAt(x, z), z, radius: 5, color: boss.gemColor, guardianId: boss.guardianId, remaining: 1.6, duration: 1.6, damage: boss.phase === 2 ? 42 : 32 });
      }
      const shots = boss.phase === 2 ? 14 : 9;
      for (let i = 0; i < shots; i++) {
        const a = i / shots * Math.PI * 2 + run.time * 0.1;
        run.combat.spawn({ x: boss.x, y: boss.y - 1.5, z: boss.z, vx: Math.cos(a) * 13, vy: -0.3, vz: Math.sin(a) * 13, damage: 22, life: 5, radius: 0.4, color: boss.gemColor || 0xff6143 });
      }
      run.combat.enemyShot(boss);
  }
  releaseSummon(run, boss) {
      boss.lastSummonAt = run.time;
      for (let i = 0; i < (boss.phase === 2 ? 5 : 3); i++) {
        if (run.enemies.filter(e => !e.dead).length >= CONFIG.enemyLimit - (5 - this.guardians.length)) break;
        const p = run.director.spawnPoint(run, 16, 25); if (p) run.spawn(i % 2 ? 'stalker' : 'drone', p.x, p.z);
      }
  }
}
