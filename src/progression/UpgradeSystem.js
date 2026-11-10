import { UPGRADES, RARITIES } from '../data/upgrades.js';
export class UpgradeSystem {
  constructor() { this.stacks = {}; this.offers = []; }
  roll(random) {
    const candidates = UPGRADES.filter(u => (this.stacks[u.id] || 0) < u.max);
    this.offers = [];
    while (this.offers.length < 3 && candidates.length) {
      let roll = random.next() * candidates.reduce((s, u) => s + RARITIES[u.rarity].weight, 0);
      let index = candidates.length - 1;
      for (let i = 0; i < candidates.length; i++) { roll -= RARITIES[candidates[i].rarity].weight; if (roll <= 0) { index = i; break; } }
      this.offers.push(candidates.splice(index, 1)[0]);
    }
    return this.offers;
  }
  apply(id, player, offeredOnly = true) {
    const upgrade = (offeredOnly ? this.offers : UPGRADES).find(u => u.id === id);
    if (!upgrade || (this.stacks[id] || 0) >= upgrade.max) return false;
    player.stats[upgrade.stat] += upgrade.amount;
    this.stacks[id] = (this.stacks[id] || 0) + 1;
    if (id === 'maxHp') player.hp += upgrade.amount;
    if (id === 'shield') player.shield += upgrade.amount;
    this.offers = []; return true;
  }
}
