import { moveCircle } from '../physics/CollisionSystem.js';
export function updateEnemy(enemy, dt, run) {
  if (enemy.dead) { enemy.state = 'Dead'; return; }
  if (enemy.behavior === 'boss' && enemy.active === false) return;
  enemy.attackTimer = Math.max(0, enemy.attackTimer - dt); enemy.flash = Math.max(0, enemy.flash - dt);
  if (enemy.stun > 0) { enemy.stun -= dt; enemy.state = 'Stunned'; return; }
  const p = run.player, dx = p.x - enemy.x, dz = p.z - enemy.z, distance = Math.hypot(dx, dz) || 0.01;
  const ranged = enemy.behavior === 'ranged';
  const retreat = ranged && distance < enemy.range * 0.55;
  const chase = distance > (ranged ? enemy.range * 0.85 : enemy.range);
  enemy.state = retreat ? 'Retreat' : chase ? 'Chase' : 'Attack';
  enemy.yaw = Math.atan2(dx, dz);
  let mx = dx / distance * (retreat ? -1 : 1), mz = dz / distance * (retreat ? -1 : 1);
  if (chase || retreat) {
    // Tangential steering around obstacles; physical resolution is always applied.
    for (const o of run.world.obstacles) {
      const ox = o.x - enemy.x, oz = o.z - enemy.z, d = Math.hypot(ox, oz);
      if (d < o.radius + enemy.radius + 3 && mx * ox + mz * oz > 0) {
        const side = mx * oz - mz * ox > 0 ? -1 : 1;
        mx += -oz / Math.max(d, 0.01) * side * 2; mz += ox / Math.max(d, 0.01) * side * 2;
      }
    }
    // Local separation keeps a horde legible without a pathfinding grid.
    for (const other of run.enemies) {
      if (other === enemy || other.dead) continue;
      const ox = enemy.x - other.x, oz = enemy.z - other.z, d = Math.hypot(ox, oz), min = enemy.radius + other.radius;
      if (d > 0.01 && d < min) { mx += ox / d * 1.5; mz += oz / d * 1.5; }
    }
    const n = Math.hypot(mx, mz) || 1, speed = enemy.speed * (enemy.phase === 2 ? 1.35 : 1);
    moveCircle(enemy, mx / n * speed * dt, mz / n * speed * dt, run.world.obstacles);
  }
  enemy.y = run.world.heightAt(enemy.x, enemy.z) + enemy.height;
  if (distance <= enemy.range && enemy.attackTimer <= 0) {
    enemy.attackTimer = enemy.cooldown;
    if (ranged) run.combat.enemyShot(enemy);
    else if (Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage);
  }
}
