import { DRONE_CLIPS, DRONE_FPS } from '../data/droneAnimations.js';
import muzzle from '../data/droneMuzzle.json';

// Baked from the exported GLB socket at frame 12: available even before rendering/loading.
export function droneMuzzlePosition(enemy) {
  const [x, y, z] = muzzle.position, c = Math.cos(enemy.yaw), s = Math.sin(enemy.yaw);
  return { x: enemy.x + x * c + z * s, y: enemy.y + y, z: enemy.z - x * s + z * c };
}
export function startDroneAttack(enemy, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.droneAction) return false;
  enemy.droneAction = { startedAt: time, speed: Math.max(.01, enemy.attackSpeed || 1), fired: false };
  enemy.state = 'Attack'; return true;
}
export function advanceDroneAttack(enemy, run) {
  const action = enemy.droneAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.droneAction = null; return false; }
  const elapsed = (run.time - action.startedAt) * action.speed, clip = DRONE_CLIPS.attack_ranged;
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / DRONE_FPS) {
    action.fired = true;
    run.combat.enemyShot(enemy, droneMuzzlePosition(enemy));
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.droneAction = null; return false; }
  return true;
}
