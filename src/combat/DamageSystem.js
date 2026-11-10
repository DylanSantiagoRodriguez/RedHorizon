export function calculateDamage(base, stats, roll = 1) {
  const critical = roll < stats.crit;
  return { amount: base * stats.damage * (critical ? stats.critDamage : 1), critical };
}
export function damageEntity(entity, amount) {
  if (entity.dead || amount <= 0) return false;
  entity.hp = Math.max(0, entity.hp - amount); entity.dead = entity.hp === 0;
  return entity.dead;
}
