export class ExperienceSystem {
  constructor() { this.level = 1; this.xp = 0; this.pending = 0; }
  get threshold() { return 20 + this.level * 12 + 3 * (this.level - 1) ** 2; }
  add(amount) {
    this.xp += Math.max(0, amount);
    let levels = 0;
    while (this.xp >= this.threshold) { this.xp -= this.threshold; this.level++; this.pending++; levels++; }
    return levels;
  }
}
