import { STALKER_CLIPS, STALKER_FPS } from '../data/stalkerAnimations.js';

export function startStalkerAttack(enemy, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.stalkerAction) return false;
  enemy.stalkerAction = { startedAt: time, speed: Math.max(0.01, enemy.attackSpeed || 1), fired: false };
  enemy.state = 'Attack';
  return true;
}

// Use simulation time, never render callbacks, for the frame-12 contact event.
export function advanceStalkerAttack(enemy, run) {
  const action = enemy.stalkerAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.stalkerAction = null; return false; }
  const elapsed = (run.time - action.startedAt) * action.speed;
  const clip = STALKER_CLIPS.attack_melee;
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / STALKER_FPS) {
    action.fired = true;
    const p = run.player, dx = p.x - enemy.x, dz = p.z - enemy.z;
    // A committed attack can be dodged sideways, behind the creature, or by jumping.
    const inFront = dx * Math.sin(enemy.yaw) + dz * Math.cos(enemy.yaw) >= 0;
    if (inFront && Math.hypot(dx, dz) <= enemy.range && Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage);
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.stalkerAction = null; return false; }
  return true;
}
