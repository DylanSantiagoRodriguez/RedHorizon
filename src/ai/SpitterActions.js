import { SPITTER_CLIPS, SPITTER_FPS } from '../data/spitterAnimations.js';
import muzzle from '../data/spitterMuzzle.json';

// Baked from the exported GLB socket at frame 15: available even before rendering/loading.
export function spitterMuzzlePosition(enemy) {
  const [x, y, z] = muzzle.position, c = Math.cos(enemy.yaw), s = Math.sin(enemy.yaw);
  return { x: enemy.x + x * c + z * s, y: enemy.y - enemy.height + y, z: enemy.z - x * s + z * c };
}
export function startSpitterAttack(enemy, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.spitterAction) return false;
  enemy.spitterAction = { startedAt: time, speed: Math.max(.01, enemy.attackSpeed || 1), fired: false };
  enemy.state = 'Attack'; return true;
}
export function advanceSpitterAttack(enemy, run) {
  const action = enemy.spitterAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.spitterAction = null; return false; }
  const elapsed = (run.time - action.startedAt) * action.speed, clip = SPITTER_CLIPS.attack_ranged;
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / SPITTER_FPS) {
    action.fired = true;
    run.combat.enemyShot(enemy, spitterMuzzlePosition(enemy));
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.spitterAction = null; return false; }
  return true;
}
