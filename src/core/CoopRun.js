import { Run } from './Run.js';
import { Player } from '../entities/Player.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { AbilitySystem } from '../combat/AbilitySystem.js';
import { UpgradeSystem } from '../progression/UpgradeSystem.js';
import { updateEnemy } from '../ai/EnemyAI.js';
import { difficultyAt } from '../world/DifficultyDirector.js';
import { CONFIG } from '../config.js';

const scoped = ['player', 'weapon', 'ability', 'upgrades', 'interaction', 'autoFire'];
export const NEUTRAL = { down: () => false, take: () => false };

// One Run, one director, one combat pool, one mission. The synchronous scope is an
// explicit adapter for the existing single-player rules, never another simulation.
export class CoopRun extends Run {
  constructor(world, seed, ids, emit, { healthPerPlayer = 0.65, upgradeMs = 15000 } = {}) {
    super(world, seed, emit);
    this.members = new Map(); this.partySize = ids.length; this.healthScale = 1 + healthPerPlayer * (ids.length - 1); this.upgradeMs = upgradeMs;
    ids.forEach((id, i) => {
      const player = new Player(world.heightAt(i * 1.5, 0)); player.id = id; player.x = i * 1.5;
      this.members.set(id, { player, weapon: new WeaponSystem(), ability: new AbilitySystem(), upgrades: new UpgradeSystem(), interaction: null, autoFire: false, abandoned: false });
    });
    Object.assign(this, this.members.values().next().value); this.round = 0; this.now = 0;
  }
  withPlayer(id, fn) {
    const member = this.members.get(id); if (!member) return;
    const previous = Object.fromEntries(scoped.map(k => [k, this[k]]));
    for (const k of scoped) this[k] = member[k];
    try { return fn(); } finally { for (const k of scoped) member[k] = this[k]; Object.assign(this, previous); }
  }
  playerById(id) { return this.members.get(id)?.player; }
  livingPlayers() { if (!this.members) return [this.player]; return [...this.members.values()].filter(m => !m.abandoned && !m.player.dead).map(m => m.player); }
  forEachLiving(fn) { for (const p of this.livingPlayers()) this.withPlayer(p.id, fn); }
  withTarget(enemy, fn) {
    const living = this.livingPlayers();
    const p = living.sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))[0];
    if (p) { enemy.targetId = p.id; return this.withPlayer(p.id, fn); }
  }
  spawnOrigin() { if (!this.members) return this.player; return this.random.pick(this.livingPlayers()) || this.player; }
  spawn(type, x, z, scale = 1) {
    // Fixed at launch: disconnecting never changes existing or future enemy HP.
    const enemy = super.spawn(type, x, z, scale);
    enemy.hp *= this.healthScale; enemy.maxHp *= this.healthScale; return enemy;
  }
  beginExtinction() { this.forEachLiving(() => { this.player.hp = 0; this.player.dead = true; }); super.beginExtinction(); }
  hurtPlayer(amount) {
    if (this.status !== 'playing' || this.mission.phase === 'cinematic') return;
    const hp = this.player.hp, shield = this.player.shield;
    if (this.player.hurt(amount * difficultyAt(this.time, this.level).damageMultiplier)) this.emit('hurt', { playerId: this.player.id, healthDamage: hp - this.player.hp, shieldDamage: shield - this.player.shield });
    this.checkDefeat();
  }
  checkDefeat() { if (!['countdown', 'cinematic'].includes(this.mission.phase) && !this.livingPlayers().length) this.status = 'defeat'; }
  abandon(id) { const m = this.members.get(id); if (m) { m.abandoned = true; m.player.hp = 0; m.player.dead = true; this.checkDefeat(); } }
  checkLevel() {
    if (this.status !== 'playing' || !this.experience.pending || ['countdown', 'cinematic'].includes(this.mission.phase)) return;
    this.round++; this.deadline = this.now + this.upgradeMs;
    for (const m of this.members.values()) { m.chosen = m.player.dead || m.abandoned; m.upgrades.offers = []; if (!m.chosen) { m.upgrades.roll(this.random); m.chosen = !m.upgrades.offers.length; } }
    this.status = 'upgrade'; this.emit('level', {});
  }
  chooseFor(id, option, round) {
    const m = this.members.get(id);
    if (this.status !== 'upgrade' || round !== this.round || !m || m.chosen || !m.upgrades.apply(option, m.player)) return false;
    m.chosen = true; return true;
  }
  update(dt, inputs = new Map(), now = this.now + dt * 1000) {
    this.now = now;
    if (this.status === 'upgrade') {
      for (const [id, m] of this.members) if (!m.chosen && now >= this.deadline) this.chooseFor(id, m.upgrades.offers[0]?.id, this.round);
      if ([...this.members.values()].every(m => m.chosen || m.abandoned)) { this.experience.pending--; this.status = 'playing'; this.checkLevel(); }
      return;
    }
    if (this.status !== 'playing') return;
    if (this.advanceMission(dt)) return;
    this.checkDefeat(); if (this.status !== 'playing') return;
    this.time += dt;
    this.forEachLiving(() => {
      this.collectGems();
      const entry = inputs.get(this.player.id);
      this.updatePlayer(dt, entry?.input || NEUTRAL, entry?.yaw || 0, entry?.aim || { x: 0, y: 0, z: -1 });
    });
    const origin = this.spawnOrigin(); if (origin) this.withPlayer(origin.id, () => this.director.update(dt, this));
    this.boss.update(dt, this);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const enemy of this.enemies) { if (this.status !== 'playing') break; this.withTarget(enemy, () => updateEnemy(enemy, dt, this)); }
    this.combat.update(dt); this.checkLevel();
    if (this.enemies.length >= CONFIG.enemyLimit) this.director.timer = Math.max(this.director.timer, 1);
  }
}
