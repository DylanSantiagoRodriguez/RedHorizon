const DEFAULTS = { salvage: 0, armor: 0, best: 0, wins: 0, runs: 0, options: { volume: 0.35, sensitivity: 1, distance: 7.5, quality: 'high', assist: false } };
export class SaveSystem {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.data = structuredClone(DEFAULTS);
    try {
      const saved = JSON.parse(storage.getItem('red-horizon-v1') || '{}');
      for (const key of ['salvage', 'armor', 'best', 'wins', 'runs']) if (Number.isFinite(saved[key]) && saved[key] >= 0) this.data[key] = saved[key];
      this.data.armor = Math.min(5, Math.floor(this.data.armor));
      const o = saved.options || {}, d = this.data.options;
      for (const [key, min, max] of [['volume', 0, 1], ['sensitivity', 0.3, 2.5], ['distance', 4, 12]]) if (Number.isFinite(o[key])) d[key] = Math.min(max, Math.max(min, o[key]));
      if (['low', 'high'].includes(o.quality)) d.quality = o.quality;
      d.assist = o.assist === true;
    } catch { /* Storage may be denied; session play remains available. */ }
  }
  write() { try { this.storage.setItem('red-horizon-v1', JSON.stringify(this.data)); } catch { /* Memory-only fallback. */ } }
  finish(run) { this.data.salvage += run.salvage; this.data.best = Math.max(this.data.best, run.time); this.data.runs++; if (run.status === 'victory') this.data.wins++; this.write(); }
  buyArmor() { const cost = 25 + this.data.armor * 15; if (this.data.armor >= 5 || this.data.salvage < cost) return false; this.data.salvage -= cost; this.data.armor++; this.write(); return true; }
}
