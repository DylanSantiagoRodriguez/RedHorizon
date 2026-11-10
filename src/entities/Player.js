import { CONFIG } from '../config.js';
import { moveCircle } from '../physics/CollisionSystem.js';
export function baseStats() {
  return { maxHp: 120, damage: 1, fireRate: 1, speed: 1, regen: 0, multishot: 0, crit: 0.06, critDamage: 1.8, explosion: 0, lifesteal: 0, cooldown: 1, pierce: 0, area: 1, shield: 0, bounce: 0 };
}
export class Player {
  constructor(height = 0) {
    Object.assign(this, { x: 0, y: height, z: 0, vx: 0, vy: 0, vz: 0, radius: CONFIG.playerRadius, grounded: true, hp: 120, shield: 0, invulnerable: 0, shieldDelay: 0, dead: false, yaw: Math.PI, steps: 0 });
    this.stats = baseStats();
  }
  update(dt, input, yaw, world) {
    const f = Number(input.down('KeyW')) - Number(input.down('KeyS'));
    const s = Number(input.down('KeyD')) - Number(input.down('KeyA'));
    const len = Math.hypot(f, s) || 1, speed = (input.down('ShiftLeft') ? 10.5 : 7) * this.stats.speed;
    const tx = (Math.sin(yaw) * f + Math.cos(yaw) * s) / len * speed;
    const tz = (-Math.cos(yaw) * f + Math.sin(yaw) * s) / len * speed;
    const blend = 1 - Math.exp(-12 * dt);
    this.vx += (tx - this.vx) * blend; this.vz += (tz - this.vz) * blend;
    moveCircle(this, this.vx * dt, this.vz * dt, world.obstacles);
    const jump = input.take('Space');
    if (jump && this.grounded) { this.vy = CONFIG.jumpSpeed; this.grounded = false; }
    const ground = world.heightAt(this.x, this.z);
    if (!this.grounded) { this.vy -= CONFIG.gravity * dt; this.y += this.vy * dt; }
    if (this.y <= ground || this.grounded) { this.y = ground; this.vy = 0; this.grounded = true; }
    if (Math.abs(f) + Math.abs(s) > 0) this.yaw = Math.atan2(this.vx, this.vz);
    if (input.buttons.size) this.yaw = Math.PI - yaw;
    this.steps += Math.hypot(this.vx, this.vz) * dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt); this.shieldDelay -= dt;
    if (this.shieldDelay <= 0) this.shield = Math.min(this.stats.shield, this.shield + dt * 8);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
  }
  hurt(amount) {
    if (this.dead || this.invulnerable > 0) return false;
    const absorbed = Math.min(this.shield, amount); this.shield -= absorbed;
    this.hp = Math.max(0, this.hp - (amount - absorbed));
    this.invulnerable = CONFIG.invulnerability; this.shieldDelay = 6;
    this.dead = this.hp <= 0; return true;
  }
}
