import { ELTE_CLIPS, ELTE_FPS } from '../data/elteAnimations.js';

export function startElteAttack(enemy, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.elteAction) return false;
  const name = enemy.elteNextAlt ? 'attack_melee_alt' : 'attack_melee';
  enemy.elteNextAlt = !enemy.elteNextAlt;
  enemy.elteAction = { name, startedAt: time, speed: Math.max(0.01, enemy.attackSpeed || 1), fired: false };
  enemy.state = 'Attack';
  return true;
}

// Use simulation time, never render callbacks, for the per-clip contact event.
export function advanceElteAttack(enemy, run) {
  const action = enemy.elteAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.elteAction = null; return false; }
  const elapsed = (run.time - action.startedAt) * action.speed;
  const clip = ELTE_CLIPS[action.name];
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / ELTE_FPS) {
    action.fired = true;
    const p = run.player, dx = p.x - enemy.x, dz = p.z - enemy.z;
    // A committed attack can be dodged sideways, behind the creature, or by jumping.
    const inFront = dx * Math.sin(enemy.yaw) + dz * Math.cos(enemy.yaw) >= 0;
    if (inFront && Math.hypot(dx, dz) <= enemy.range && Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage);
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.elteAction = null; return false; }
  return true;
}
