import { it, expect } from 'vitest';
import { EventQueue, operationalEvent } from '../server/observability/events.js';
it('never copies tokens, public room codes, IPs or arbitrary error text into an event', () => {
 const e = operationalEvent('rh-gateway', 'security.rejected', { reason: 'secret-in-error', token: 'secret', code: 'ABC123', ip: '1.2.3.4' });
 expect(e.data).toEqual({ reason: 'unknown' });
 expect(() => operationalEvent('rh-game-01', 'room.created', { roomId: 'ABC123' })).toThrow();
 expect(() => operationalEvent('untrusted', 'connection.opened')).toThrow();
});
it('bounds memory while the destination is unavailable and retains no unbounded retry backlog', async () => {
 const q = new EventQueue({ capacity: 2, batchSize: 1, send: async () => { throw new Error('offline'); } });
 expect(q.publish('rh-gateway', 'connection.opened')).toBe(true);
 q.publish('rh-gateway', 'connection.opened'); expect(q.publish('rh-gateway', 'connection.opened')).toBe(false);
 await q.flush(); expect(q.status()).toEqual({ pending: 1, inFlight: false, dropped: 2, delivered: 0 });
 q.send = async batch => expect(batch).toHaveLength(1); await q.flush(); expect(q.delivered).toBe(1);
});
it('aborts a slow transport without blocking synchronous publication', async () => {
 const q = new EventQueue({ timeoutMs: 10, send: (_batch, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))) });
 q.publish('rh-gateway', 'connection.opened'); const pending = q.flush();
 expect(q.publish('rh-gateway', 'connection.opened')).toBe(true);
 await pending; expect(q.dropped).toBe(1); expect(q.items).toHaveLength(1);
});
