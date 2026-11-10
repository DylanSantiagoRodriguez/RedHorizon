export class Random {
  constructor(seed = 'RED-HORIZON') {
    this.state = 2166136261;
    for (const c of String(seed)) this.state = Math.imul(this.state ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  next() {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.next() * (max - min); }
  pick(items) { return items[Math.floor(this.next() * items.length)]; }
}
