import { CONFIG } from '../config.js';
import { ObjectPool } from '../utils/ObjectPool.js';
import { segmentHit } from '../physics/CollisionSystem.js';
import { calculateDamage, damageEntity } from './DamageSystem.js';
export class CombatSystem {
  constructor(run) { this.run = run; this.nextId = 1; this.pool = new ObjectPool(CONFIG.projectileLimit, () => ({ hits: new Set() })); }
  spawn(data) {
    const p = this.pool.acquire(); if (!p) return;
    p.hits.clear(); Object.assign(p, { id: this.nextId++, ownerId: data.friendly ? this.run.player.id : null, pierce: 0, bounce: 0, blast: 0, radius: 0.22, color: 0xc4ed71, friendly: false, kind: null }, data);
  }
  enemyShot(enemy, origin = enemy) {
    const p = this.run.player, dx = p.x - origin.x, dy = p.y + 1 - origin.y, dz = p.z - origin.z, d = Math.hypot(dx, dy, dz) || 1, speed = enemy.type === 'spitter' ? 13 : 18;
    this.spawn({ x: origin.x, y: origin.y, z: origin.z, vx: dx / d * speed, vy: dy / d * speed, vz: dz / d * speed, damage: enemy.damage, life: 4, color: enemy.gemColor || (enemy.type === 'spitter' ? 0x73df94 : enemy.type === 'drone' ? 0x67dfea : 0xff6852) });
  }
  hit(enemy, damage, chain = true, attacker = this.run.player) {
    if (enemy.dead) return;
    const run = this.run, result = calculateDamage(damage, attacker.stats, run.random.next());
    const actualDamage = Math.min(enemy.hp, result.amount);
    const killed = damageEntity(enemy, result.amount); enemy.flash = 0.12;
    run.emit('hit', { playerId: attacker.id, x: enemy.x, y: enemy.y, z: enemy.z, amount: Math.round(actualDamage), critical: result.critical, killed });
    if (!attacker.dead) attacker.hp = Math.min(attacker.stats.maxHp, attacker.hp + actualDamage * attacker.stats.lifesteal);
    if (killed) {
      enemy.state = 'Dead'; run.kills++; run.onKill(enemy);
      run.emit('death', { x: enemy.x, y: enemy.y, z: enemy.z, color: enemy.color });
      if (chain && attacker.stats.explosion) this.explode(enemy.x, enemy.y, enemy.z, 3.4 * attacker.stats.area, attacker.stats.explosion, false, attacker);
    }
  }
  explode(x, y, z, radius, damage, chain = false, attacker = this.run.player) {
    this.run.emit('explosion', { playerId: attacker.id, x, y, z, radius });
    for (const e of this.run.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y, e.z - z) < radius + e.radius) this.hit(e, damage, chain, attacker);
  }
  update(dt) {
    const run = this.run;
    for (const p of this.pool.items) {
      if (run.status !== 'playing') break;
      if (!p.active) continue;
      const ax = p.x, ay = p.y, az = p.z;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
      let collision = p.y < run.world.heightAt(p.x, p.z);
      for (const o of run.world.obstacles) {
        const base = run.world.heightAt(o.x, o.z), height = o.height || 6;
        if (p.y > base + height + 0.4) continue;
        if (segmentHit(ax, 0, az, p.x, 0, p.z, o.x, 0, o.z, o.radius)) { collision = true; break; }
      }
      if (p.friendly && !collision) {
        for (const e of run.enemies) {
          if (e.dead || p.hits.has(e.id)) continue;
          if (segmentHit(ax, ay, az, p.x, p.y, p.z, e.x, e.y, e.z, e.radius + p.radius)) {
            p.hits.add(e.id);
            if (p.blast) { collision = true; break; }
            this.hit(e, p.damage, true, run.playerById?.(p.ownerId) || run.player);
            if (p.bounce > 0) {
              let target = null, nearest = 16;
              for (const other of run.enemies) {
                const d = Math.hypot(other.x - p.x, other.y - p.y, other.z - p.z);
                if (!other.dead && !p.hits.has(other.id) && d < nearest) { target = other; nearest = d; }
              }
              if (target) {
                const speed = Math.hypot(p.vx, p.vy, p.vz); p.vx = (target.x - p.x) / nearest * speed; p.vy = (target.y - p.y) / nearest * speed; p.vz = (target.z - p.z) / nearest * speed; p.bounce--; break;
              }
            }
            if (p.pierce-- <= 0) { collision = true; break; }
          }
        }
      } else if (!p.friendly && !collision) {
        for (const player of run.livingPlayers?.() || [run.player]) {
        if (segmentHit(ax, ay, az, p.x, p.y, p.z, player.x, player.y + (player.slideTime > 0 ? 0.45 : 1), player.z, player.slideTime > 0 ? 0.5 : 0.85)) { if (run.withPlayer) run.withPlayer(player.id, () => run.hurtPlayer(p.damage)); else run.hurtPlayer(p.damage); collision = true; break; }
        }
      }
      if (collision || p.life <= 0) {
        if (p.blast) { const attacker = run.playerById?.(p.ownerId) || run.player; this.explode(p.x, p.y, p.z, p.blast * attacker.stats.area, p.damage, false, attacker); }
        run.emit('impact', { x: p.x, y: p.y, z: p.z, color: p.color }); p.active = false;
      }
    }
  }
}
