import { isAmethyst } from '../data/amethystAnimations.js';
import { advanceAmethystAction, startAmethystAction } from './AmethystActions.js';
import { isEmerald } from '../data/emeraldAnimations.js';
import { advanceEmeraldAction, startEmeraldAction } from './EmeraldActions.js';
import { isSapphire } from '../data/sapphireAnimations.js';
import { advanceSapphireAction, startSapphireAction } from './SapphireActions.js';
import { moveCircle } from '../physics/CollisionSystem.js';
import { isDust } from '../data/dustAnimations.js';
import { advanceDustAction, startDustAction } from './DustActions.js';
import { advanceStalkerAttack, startStalkerAttack } from './StalkerActions.js';
import { advanceBruteAttack, startBruteAttack } from './BruteActions.js';
import { advanceSpitterAttack, startSpitterAttack } from './SpitterActions.js';
import { advanceDroneAttack, startDroneAttack } from './DroneActions.js';
import { advanceElteAttack, startElteAttack } from './ElteActions.js';
import { isRuby } from '../data/rubyAnimations.js';
import { advanceRubyAction, startRubyAction } from './RubyActions.js';
export function updateEnemy(enemy, dt, run) {
  if (enemy.dead) { enemy.rubyAction = null; enemy.sapphireAction = null; enemy.amethystAction = null; enemy.emeraldAction = null; enemy.stalkerAction = null; enemy.bruteAction = null; enemy.elteAction = null; enemy.spitterAction = null; enemy.droneAction = null; enemy.state = 'Dead'; return; }
  if (enemy.behavior === 'boss' && enemy.active === false) return;
  enemy.attackTimer = Math.max(0, enemy.attackTimer - dt); enemy.flash = Math.max(0, enemy.flash - dt);
  if (enemy.stun > 0) { enemy.stun = Math.max(0, enemy.stun - dt); enemy.dustAction = null; enemy.rubyAction = null; enemy.sapphireAction = null; enemy.amethystAction = null; enemy.emeraldAction = null; enemy.stalkerAction = null; enemy.bruteAction = null; enemy.elteAction = null; enemy.spitterAction = null; enemy.droneAction = null; enemy.state = 'Stunned'; return; }
  if (isDust(enemy) && advanceDustAction(enemy, run)) return;
  if (enemy.type === 'stalker' && advanceStalkerAttack(enemy, run)) return;
  if (enemy.type === 'brute' && advanceBruteAttack(enemy, run)) return;
  if (enemy.type === 'spitter' && advanceSpitterAttack(enemy, run)) return;
  if (enemy.type === 'drone' && advanceDroneAttack(enemy, run)) return;
  if (enemy.type === 'elite' && advanceElteAttack(enemy, run)) return;
  if (isRuby(enemy) && advanceRubyAction(enemy, run)) return;
  if (isSapphire(enemy) && advanceSapphireAction(enemy, run)) return;
  if (isEmerald(enemy) && advanceEmeraldAction(enemy, run)) return;
  if (isAmethyst(enemy) && advanceAmethystAction(enemy, run)) return;
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
    if (isDust(enemy)) startDustAction(enemy, 'attack_melee', run.time);
    else if (enemy.type === 'stalker') startStalkerAttack(enemy, run.time);
    else if (enemy.type === 'brute') startBruteAttack(enemy, run.time);
    else if (enemy.type === 'spitter') startSpitterAttack(enemy, run.time);
    else if (enemy.type === 'drone') startDroneAttack(enemy, run.time);
    else if (enemy.type === 'elite') startElteAttack(enemy, run.time);
    else if (isRuby(enemy)) startRubyAction(enemy, 'attack_melee', run.time);
    else if (isSapphire(enemy)) startSapphireAction(enemy, 'attack_melee', run.time);
    else if (isEmerald(enemy)) startEmeraldAction(enemy, 'attack_melee', run.time);
    else if (isAmethyst(enemy)) startAmethystAction(enemy, 'attack_melee', run.time);
    else if (ranged) run.combat.enemyShot(enemy);
    else if (Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage);
  }
}
