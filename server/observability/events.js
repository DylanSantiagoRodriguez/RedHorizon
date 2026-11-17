import { randomUUID } from 'node:crypto';
const sources = new Set(['rh-gateway', 'rh-game-01', 'rh-game-02', 'rh-game-03', 'rh-coordinator']);
const fields = {
  'room.created': ['roomId'], 'room.closed': ['roomId', 'durationSeconds'],
  'connection.opened': [], 'connection.closed': ['reason'], 'connection.reconnected': [],
  'security.rejected': ['reason'], 'deployment.changed': ['revision'],
};
const reasons = new Set(['rate', 'size', 'authentication', 'certificate', 'timeout', 'backpressure', 'normal', 'transport', 'unknown']);
export function operationalEvent(source, type, data = {}, now = Date.now()) {
  if (!sources.has(source) || !Object.hasOwn(fields, type)) throw new Error('Invalid event source or type');
  const safe = {};
  for (const field of fields[type]) {
    const value = data[field];
    if (field === 'roomId' && !/^[a-f0-9-]{36}$/.test(value || '')) throw new Error('Internal room UUID required');
    if (field === 'durationSeconds' && (!Number.isFinite(value) || value < 0)) throw new Error('Invalid duration');
    if (field === 'revision' && !/^[a-f0-9]{40}$/.test(value || '')) throw new Error('Invalid revision');
    safe[field] = field === 'reason' ? reasons.has(value) ? value : 'unknown' : value;
  }
  return { schemaVersion: 1, eventId: randomUUID(), timestamp: now, source, type, data: safe };
}
// No raw packet, room code, IP, nickname or session token is accepted into events.
export class EventQueue {
  constructor({ send, capacity = 256, batchSize = 32, timeoutMs = 1000 }) {
    if (typeof send !== 'function' || !Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(batchSize) || batchSize < 1 || timeoutMs <= 0) throw new Error('Invalid queue');
    Object.assign(this, { send, capacity, batchSize, timeoutMs });
    this.items = []; this.inFlight = false; this.dropped = 0; this.delivered = 0;
  }
  publish(source, type, data) {
    try {
      if (this.items.length >= this.capacity) { this.dropped++; return false; }
      this.items.push(operationalEvent(source, type, data)); return true;
    } catch { this.dropped++; return false; }
  }
  async flush() {
    if (this.inFlight || !this.items.length) return;
    this.inFlight = true;
    const batch = this.items.splice(0, this.batchSize), controller = new AbortController();
    // A stuck sender keeps at most one batch in flight; publication still never
    // blocks the game and the pending queue remains bounded. Senders must honor abort.
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try { await this.send(batch, controller.signal); this.delivered += batch.length; }
    catch { this.dropped += batch.length; }
    finally { clearTimeout(timer); this.inFlight = false; }
  }
  status() { return { pending: this.items.length, inFlight: this.inFlight, dropped: this.dropped, delivered: this.delivered }; }
}
