import { ENEMIES } from '../data/enemies.js';
export function createEnemy(id, type, x, z, scale = 1) {
  const data = ENEMIES[type];
  return { ...data, id, type, x, y: 0, z, maxHp: data.hp * scale, hp: data.hp * scale, damage: data.damage * Math.sqrt(scale), dead: false, state: 'Idle', attackTimer: 1.5, stun: 0, yaw: 0, phase: 1, abilityTimer: 3, summonTimer: 14, flash: 0 };
}
