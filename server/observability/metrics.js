// Bounded, low-cardinality metrics. Call sites use fixed labels, never user IDs/IPs.
export class Metrics {
  constructor(limit = 512) { this.values = new Map(); this.limit = limit; }
  set(name, value, labels = {}) {
    if (!/^rh_[a-z0-9_]+$/.test(name) || !Number.isFinite(value)) return;
    const entries = Object.entries(labels).sort();
    if (entries.some(([k, v]) => !['peer', 'reason', 'le', 'endpoint', 'event', 'revision'].includes(k) || !/^[a-zA-Z0-9_.+-]{1,64}$/.test(String(v)))) return;
    const key = name + JSON.stringify(entries);
    if (!this.values.has(key) && this.values.size >= this.limit) return;
    this.values.set(key, { name, labels: Object.fromEntries(entries), value });
  }
  inc(name, value = 1, labels = {}) { const key = name + JSON.stringify(Object.entries(labels).sort()); this.set(name, (this.values.get(key)?.value || 0) + value, labels); }
  observe(name, ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    for (const bound of [1, 5, 10, 25, 50, 100, 200, 500, 1000, 3000, Infinity]) this.inc(name + '_bucket', ms <= bound ? 1 : 0, { le: bound === Infinity ? '+Inf' : String(bound) });
    this.inc(name + '_sum', ms); this.inc(name + '_count');
  }
  snapshot() { return [...this.values.values()]; }
}
export function prometheus(rows, node) {
  return rows.map(({ name, labels = {}, value }) => `${name}{node="${node}"${Object.entries(labels).map(([k, v]) => `,${k}="${v}"`).join('')}} ${value}`).join('\n') + '\n';
}
