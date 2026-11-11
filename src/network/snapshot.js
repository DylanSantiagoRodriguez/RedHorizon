// Explicit wire DTOs. No classes, render objects, tokens, Sets or engine graphs.
const pick = (value, fields) => Object.fromEntries(fields.split(' ').filter(k => value[k] !== undefined).map(k => [k, value[k]]));
const PLAYER = 'id x y z vx vy vz radius grounded hp shield shieldDelay dead yaw steps groundTime hasJumped jumpBuffer slideTime slideCooldown hopChain hitSerial interactSerial';
const ENEMY = 'id type x y z radius height hp maxHp damage dead state attackTimer stun yaw phase abilityTimer summonTimer flash speed range cooldown behavior xp color name gemColor guardianId active rewardGranted targetId attackSpeed lastAbilityAt lastSummonAt';
const ACTION = 'name startedAt speed fired variant';
const ACTION_FIELDS = ['dustAction', 'rubyAction', 'sapphireAction', 'emeraldAction', 'amethystAction', 'stalkerAction', 'bruteAction', 'spitterAction', 'droneAction', 'elteAction'];
export function enemyDTO(e) { const dto = pick(e, ENEMY); for (const key of ACTION_FIELDS) if (e[key]) dto[key] = pick(e[key], ACTION); return dto; }
export function snapshot(room, now) {
  const r = room.run;
  return {
    type: 'snapshot', tick: room.tick, serverTime: now, seed: r.seed, status: r.status, time: r.time, kills: r.kills, salvage: r.salvage,
    mission: pick(r.mission, 'phase countdown cinematic'), experience: pick(r.experience, 'level xp pending threshold'), round: r.round, deadline: r.deadline || 0,
    players: [...r.members].map(([id, m]) => ({ ...pick(m.player, PLAYER), stats: { ...m.player.stats }, nickname: room.members.get(id).nickname, connected: !!room.members.get(id).socket, abandoned: m.abandoned, ack: room.members.get(id).ack,
      weapon: { ...pick(m.weapon, 'equipped timer recoil shotId'), aim: m.weapon.aim && pick(m.weapon.aim, 'x y z'), lastShot: m.weapon.lastShot && pick(m.weapon.lastShot, 'kind time') }, ability: pick(m.ability, 'timer shieldTime'),
      upgrades: { stacks: { ...m.upgrades.stacks }, offers: m.upgrades.offers.map(o => o.id) }, chosen: !!m.chosen, interactionId: m.interaction?.id || null, autoFire: m.autoFire })),
    enemies: r.enemies.map(enemyDTO), projectiles: r.combat.pool.items.filter(p => p.active).map(p => pick(p, 'id ownerId x y z vx vy vz radius color kind friendly life active')),
    gems: r.gems.map(g => pick(g, 'id x z color collected')), altars: r.altars.map(a => pick(a, 'id x z color name index type used')),
    interactables: [r.launchBeacon, ...r.world.beacons, ...r.world.rewards].map(o => pick(o, 'id used')),
    boss: { guardians: r.boss.guardians.map(enemyDTO), zones: r.boss.zones.map(z => pick(z, 'id x y z radius color guardianId remaining duration')), enemyId: r.boss.enemy?.id || null },
    events: room.events,
  };
}
