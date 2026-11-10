import { Random } from '../utils/Random.js';
import { Player } from '../entities/Player.js';
import { createEnemy } from '../entities/Enemy.js';
import { updateEnemy } from '../ai/EnemyAI.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { DifficultyDirector, difficultyAt } from '../world/DifficultyDirector.js';
import { ExperienceSystem } from '../progression/ExperienceSystem.js';
import { UpgradeSystem } from '../progression/UpgradeSystem.js';
import { AbilitySystem } from '../combat/AbilitySystem.js';
import { BossController } from '../ai/BossController.js';
import { CONFIG } from '../config.js';
export class Run {
  constructor(world, seed, emit = () => {}) {
    this.world = world; this.seed = seed; this.random = new Random(`${seed}-combat`); this.emit = emit;
    this.player = new Player(world.heightAt(0, 0)); this.enemies = []; this.time = 0; this.kills = 0; this.nextId = 1; this.status = 'playing';
    this.combat = new CombatSystem(this); this.weapon = new WeaponSystem();
    this.director = new DifficultyDirector();
    this.experience = new ExperienceSystem(); this.upgrades = new UpgradeSystem(); this.salvage = 0;
    this.ability = new AbilitySystem(); this.boss = new BossController(); this.relays = 0; this.interaction = null; this.autoFire = false; this.gems = []; this.mission = { phase: 'collect', countdown: 60, cinematic: 0 }; this.launchBeacon = { x: 0, z: 7, type: 'launch', used: false }; this.altars = this.boss.prepareAltars(this);
  }
  spawn(type, x, z, scale = 1) { const enemy = createEnemy(this.nextId++, type, x, z, scale); enemy.y = this.world.heightAt(x, z) + enemy.height; this.enemies.push(enemy); return enemy; }
  get level() { return this.experience.level; }
  onKill(enemy) {
    if (enemy.rewardGranted) return;
    enemy.rewardGranted = true;
    if (enemy.gemColor) this.gems.push({ id: enemy.id, x: enemy.x, z: enemy.z, color: enemy.gemColor, collected: false });
    this.experience.add(enemy.xp); this.salvage += enemy.type === 'elite' ? 5 : 1;
    if (enemy.type === 'titan' && this.boss.guardians.length === 5 && this.boss.guardians.every(b => b.dead)) this.salvage += 50;
  }
  interact() {
    const target = this.interaction; if (!target || target.used) return false;
    if (target.type === 'altar') return this.boss.awaken(this, target);
    if (target.type === 'launch') {
      if (this.mission.phase !== 'ready') return false;
      target.used = true; this.mission.phase = 'countdown'; this.emit('launch', {}); return true;
    }
    target.used = true;
    if (target.type) { this.relays++; this.salvage += 15; this.experience.add(35); this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 30); this.emit('relay', {}); }
    else { this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 45); this.salvage += 3; this.emit('upgrade', {}); }
    return true;
  }
  checkLevel() {
    if (this.mission.phase === 'countdown' || this.mission.phase === 'cinematic') return;
    if (this.experience.pending > 0 && this.status === 'playing') {
      this.upgrades.roll(this.random);
      if (!this.upgrades.offers.length) { this.player.hp = this.player.stats.maxHp; this.experience.pending = 0; return; }
      this.status = 'upgrade'; this.emit('level', {});
    }
  }
  chooseUpgrade(id) {
    if (this.status !== 'upgrade' || !this.upgrades.apply(id, this.player)) return false;
    this.experience.pending--; this.status = 'playing'; this.emit('upgrade', {}); this.checkLevel(); return true;
  }
  hurtPlayer(amount) {
    if (this.status !== 'playing' || this.mission.phase === 'cinematic') return;
    const hp = this.player.hp, shield = this.player.shield;
    const damage = amount * difficultyAt(this.time, this.level).damageMultiplier;
    if (this.player.hurt(damage)) this.emit('hurt', { healthDamage: hp - this.player.hp, shieldDamage: shield - this.player.shield });
    if (this.player.dead && this.mission.phase !== 'countdown') this.status = 'defeat';
  }
  beginExtinction() {
    this.mission.phase = 'cinematic'; this.mission.cinematic = 0; this.interaction = null;
    this.player.hp = 0; this.player.dead = true;
    for (const enemy of this.enemies) enemy.dead = true;
    this.combat.pool.clear(); this.emit('extinction', {});
  }
  update(dt, input, yaw, aim) {
    if (this.status !== 'playing') return;
    if (this.mission.phase === 'cinematic') {
      this.mission.cinematic += dt;
      if (this.mission.cinematic >= 24) { this.status = 'victory'; this.emit('victory', {}); }
      return;
    }
    if (this.mission.phase === 'countdown') {
      this.mission.countdown = Math.max(0, this.mission.countdown - dt);
      if (this.mission.countdown === 0) { this.beginExtinction(); return; }
    }
    if (this.player.dead) { this.time += dt; return; }
    for (const g of this.gems) if (Math.hypot(g.x - this.player.x, g.z - this.player.z) < 2.5) g.collected = true;
    if (this.mission.phase === 'collect' && this.gems.length === 5 && this.gems.every(g => g.collected)) { this.mission.phase = 'ready'; this.emit('beaconReady', {}); }
    this.time += dt; this.player.update(dt, input, yaw, this.world); this.weapon.update(dt); this.weapon.aim = aim;
    this.director.update(dt, this); this.ability.update(dt, this); this.boss.update(dt, this);
    for (const [key, weapon] of [['Digit1', 'plasma'], ['Digit2', 'scatter'], ['Digit3', 'nova']]) if (input.take(key)) this.weapon.equipped = weapon;
    if (input.take('KeyF')) this.autoFire = !this.autoFire;
    if (input.take('KeyQ')) this.ability.activate(this);
    this.interaction = [this.launchBeacon, ...this.altars, ...(this.world.beacons || []), ...(this.world.rewards || [])].find(o => !o.used && Math.hypot(this.player.x - o.x, this.player.z - o.z) < 3.5) || null;
    if (input.take('KeyE')) this.interact();
    if ((input.down ? input.down('Mouse0') : input.buttons.has(0)) || this.autoFire) { this.weapon.fire(this, aim); }
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const enemy of this.enemies) { if (this.status !== 'playing') break; updateEnemy(enemy, dt, this); }
    this.combat.update(dt);
    this.checkLevel();
    // Keep the boss spawn slot available even at maximum horde pressure.
    if (!this.boss.spawned && this.enemies.length >= CONFIG.enemyLimit) this.director.timer = Math.max(this.director.timer, 1);
  }
}
