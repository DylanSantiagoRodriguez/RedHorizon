import { Random } from '../utils/Random.js';
import { Player } from '../entities/Player.js';
import { createEnemy } from '../entities/Enemy.js';
import { updateEnemy } from '../ai/EnemyAI.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { DifficultyDirector } from '../world/DifficultyDirector.js';
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
    this.ability = new AbilitySystem(); this.boss = new BossController(); this.relays = 0; this.interaction = null; this.autoFire = false;
  }
  spawn(type, x, z, scale = 1) { const enemy = createEnemy(this.nextId++, type, x, z, scale); enemy.y = this.world.heightAt(x, z) + enemy.height; this.enemies.push(enemy); return enemy; }
  get level() { return this.experience.level; }
  onKill(enemy) {
    this.experience.add(enemy.xp); this.salvage += enemy.type === 'elite' ? 5 : 1;
    if (enemy.type === 'titan' && !this.player.dead) { this.status = 'victory'; this.salvage += 50; this.emit('victory', {}); }
  }
  interact() {
    const target = this.interaction; if (!target || target.used) return false;
    target.used = true;
    if (target.type) { this.relays++; this.salvage += 15; this.experience.add(35); this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 30); this.emit('relay', {}); }
    else { this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 45); this.salvage += 3; this.emit('upgrade', {}); }
    return true;
  }
  checkLevel() {
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
  hurtPlayer(amount) { if (this.status !== 'playing') return; if (this.player.hurt(amount)) this.emit('hurt', {}); if (this.player.dead) this.status = 'defeat'; }
  update(dt, input, yaw, aim) {
    if (this.status !== 'playing') return;
    this.time += dt; this.player.update(dt, input, yaw, this.world); this.weapon.update(dt);
    this.director.update(dt, this); this.ability.update(dt, this); this.boss.update(dt, this);
    for (const [key, weapon] of [['Digit1', 'plasma'], ['Digit2', 'scatter'], ['Digit3', 'nova']]) if (input.take(key)) this.weapon.equipped = weapon;
    if (input.take('KeyF')) this.autoFire = !this.autoFire;
    if (input.take('KeyQ')) this.ability.activate(this);
    this.interaction = [...(this.world.beacons || []), ...(this.world.rewards || [])].find(o => !o.used && Math.hypot(this.player.x - o.x, this.player.z - o.z) < 3.5) || null;
    if (input.take('KeyE')) this.interact();
    if (input.buttons.has(0) || this.autoFire) { this.player.yaw = Math.atan2(aim.x, aim.z); this.weapon.fire(this, aim); }
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const enemy of this.enemies) { if (this.status !== 'playing') break; updateEnemy(enemy, dt, this); }
    this.combat.update(dt);
    this.checkLevel();
    // Keep the boss spawn slot available even at maximum horde pressure.
    if (!this.boss.spawned && this.enemies.length >= CONFIG.enemyLimit) this.director.timer = Math.max(this.director.timer, 1);
  }
}
