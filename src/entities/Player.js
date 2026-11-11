import { CONFIG } from '../config.js';
import { moveCircle } from '../physics/CollisionSystem.js';
export function baseStats() {
  return { maxHp: 120, damage: 1, fireRate: 1, speed: 1, regen: 0, multishot: 0, crit: 0.06, critDamage: 1.8, explosion: 0, lifesteal: 0, cooldown: 1, pierce: 0, area: 1, shield: 0, bounce: 0 };
}
export class Player {
  constructor(height = 0) {
    Object.assign(this, { x: 0, y: height, z: 0, vx: 0, vy: 0, vz: 0, radius: CONFIG.playerRadius, grounded: true, hp: 120, shield: 0, shieldDelay: 0, dead: false, yaw: Math.PI, steps: 0 });
    this.stats = baseStats(); this.groundTime = 1; this.hasJumped = false; this.jumpBuffer = 0; this.slideTime = 0; this.slideCooldown = 0; this.hopChain = 0; this.hitSerial = 0; this.interactSerial = 0;
  }
  update(dt, input, yaw, world) {
    const f = Number(input.down('KeyW')) - Number(input.down('KeyS'));
    const s = Number(input.down('KeyD')) - Number(input.down('KeyA'));
    const len = Math.hypot(f, s) || 1, moving = !!(f || s);
    const speed = (input.down('ShiftLeft') ? 10.5 : 7) * this.stats.speed;
    const dx = (Math.sin(yaw) * f + Math.cos(yaw) * s) / len;
    const dz = (-Math.cos(yaw) * f + Math.sin(yaw) * s) / len;
    this.groundTime = this.grounded ? this.groundTime + dt : 0;
    this.slideTime = Math.max(0, this.slideTime - dt);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.take('Space')) this.jumpBuffer = 0.12;
    const velocity = Math.hypot(this.vx, this.vz);
    if (input.take('ControlLeft') && this.grounded && velocity >= 6 && this.slideCooldown === 0) {
      this.slideTime = 0.8; this.slideCooldown = 1.2;
      const boost = Math.min(18, velocity + 2) / velocity;
      this.vx *= boost; this.vz *= boost;
    }
    if (this.grounded && (this.jumpBuffer > 0 || input.down('Space'))) {
      const chained = this.hasJumped && this.groundTime <= 0.12 && moving && velocity >= 5;
      this.hopChain = chained ? this.hopChain + 1 : 0;
      if (chained) {
        const boost = Math.min(Math.max(speed, 18), velocity + 1.4) / velocity;
        this.vx *= boost; this.vz *= boost;
      }
      this.hasJumped = true; this.jumpBuffer = 0; this.slideTime = 0;
      this.vy = CONFIG.jumpSpeed; this.grounded = false;
    }
    if (this.slideTime > 0) {
      const friction = Math.exp(-0.85 * dt); this.vx *= friction; this.vz *= friction;
    } else if (this.grounded) {
      const blend = 1 - Math.exp(-12 * dt);
      this.vx += (dx * speed - this.vx) * blend; this.vz += (dz * speed - this.vz) * blend;
      if (this.groundTime > 0.12) this.hopChain = 0;
    } else if (moving) {
      // Limited air steering preserves earned momentum without accelerating by itself.
      const current = Math.hypot(this.vx, this.vz), targetSpeed = Math.max(speed, current);
      const blend = 1 - Math.exp(-2.5 * dt);
      this.vx += (dx * targetSpeed - this.vx) * blend; this.vz += (dz * targetSpeed - this.vz) * blend;
    }
    moveCircle(this, this.vx * dt, this.vz * dt, world.obstacles);
    if (!this.grounded) { this.vy -= CONFIG.gravity * dt; this.y += this.vy * dt; }
    const ground = world.heightAt(this.x, this.z);
    if (this.y <= ground || this.grounded) { this.y = ground; this.vy = 0; this.grounded = true; }
    // Face the camera heading independently of movement direction.
    this.yaw = Math.PI - yaw;
    this.steps += Math.hypot(this.vx, this.vz) * dt;
    this.shieldDelay -= dt;
    if (this.shieldDelay <= 0) this.shield = Math.min(this.stats.shield, this.shield + dt * 8);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
  }
  hurt(amount) {
    if (this.dead) return false;
    this.hitSerial++;
    const absorbed = Math.min(this.shield, amount); this.shield -= absorbed;
    this.hp = Math.max(0, this.hp - (amount - absorbed));
    this.shieldDelay = 6;
    this.dead = this.hp <= 0; return true;
  }
}
