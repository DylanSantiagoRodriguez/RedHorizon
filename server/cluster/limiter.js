// Bounded token buckets: separate burst and sustained budgets by operation.
export class Limiter {
  constructor(maxKeys = 10000, now = Date.now) { this.buckets = new Map(); this.maxKeys = maxKeys; this.now = now; }
  take(key, burst, perSecond) {
    const now = this.now(); let b = this.buckets.get(key);
    if (!b) { if (this.buckets.size >= this.maxKeys) this.sweep(); if (this.buckets.size >= this.maxKeys) return false; b = { tokens: burst, at: now }; }
    b.tokens = Math.min(burst, b.tokens + Math.max(0, now - b.at) * perSecond / 1000); b.at = now;
    this.buckets.set(key, b); if (b.tokens < 1) return false; b.tokens--; return true;
  }
  sweep() { const now = this.now(); for (const [key, b] of this.buckets) if (now - b.at > 120000) this.buckets.delete(key); }
}
