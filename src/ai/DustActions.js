import { DUST_CLIPS } from '../data/dustAnimations.js';

export function startDustAction(enemy, name, time) {
  if (enemy.dead || enemy.stun > 0 || enemy.dustAction) return false;
  enemy.dustAction = { name, startedAt: time, fired: false };
  enemy.state = name === 'summon' ? 'Summon' : name === 'attack_special' ? 'Special' : 'Attack';
  return true;
}

// Simulation owns events. A dropped render frame or a paused mixer cannot skip damage.
export function advanceDustAction(enemy, run) {
  const action = enemy.dustAction;
  if (!action) return false;
  if (enemy.dead || enemy.stun > 0) { enemy.dustAction = null; return false; }
  const clip = DUST_CLIPS[action.name], elapsed = run.time - action.startedAt;
  if (!action.fired && elapsed + 1e-8 >= clip.eventFrame / 30) {
    action.fired = true;
    if (action.name === 'attack_special') run.boss.releaseAbility(run, enemy);
    else if (action.name === 'summon') run.boss.releaseSummon(run, enemy);
    else {
      const strike = () => { const p = run.player;
      if (Math.hypot(p.x - enemy.x, p.z - enemy.z) <= enemy.range && Math.abs(p.y + 1 - enemy.y) < enemy.height + 1.2) run.hurtPlayer(enemy.damage); };
      if (run.forEachLiving) run.forEachLiving(strike); else strike();
    }
  }
  if (elapsed + 1e-8 >= clip.duration) { enemy.dustAction = null; return false; }
  return true;
}
