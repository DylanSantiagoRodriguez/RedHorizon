import { BRUTE_CLIPS, BRUTE_FPS } from '../data/bruteAnimations.js';

export function startBruteAttack(enemy, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.bruteAction) return false;
  enemy.bruteAction = { startedAt: time, speed: Math.max(0.01, enemy.attackSpeed || 1), fired: false };
  enemy.state = 'Attack';
  return true;
}

// Use simulation time, never render callbacks, for the frame-18 contact event.
export function advanceBruteAttack(enemy, run) {
  const action = enemy.bruteAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.bruteAction = null; return false; }
  const elapsed = (run.time - action.startedAt) * action.speed;
  const clip = BRUTE_CLIPS.attack_melee;
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / BRUTE_FPS) {
    action.fired = true;
    const p = run.player, dx = p.x - enemy.x, dz = p.z - enemy.z;
    // A committed attack can be dodged sideways, behind the creature, or by jumping.
    const inFront = dx * Math.sin(enemy.yaw) + dz * Math.cos(enemy.yaw) >= 0;
    if (inFront && Math.hypot(dx, dz) <= enemy.range && Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage);
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.bruteAction = null; return false; }
  return true;
}
