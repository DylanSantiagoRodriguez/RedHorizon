import { it, expect } from 'vitest';
import { TOTP } from 'otpauth';
import { Auth, passwordHash } from '../server/observability/auth.js';
import { EventStore } from '../server/observability/store.js';
import { operationalEvent } from '../server/observability/events.js';
import { Metrics, prometheus } from '../server/observability/metrics.js';
import { createPanel } from '../server/observability/panel.js';
const secret = 'JBSWY3DPEHPK3PXP'; // Public test fixture, never a deployed credential.
it('requires both factors, prevents OTP replay, expires and revokes sessions', async () => {
 const store = new EventStore(); let now = Date.now();
 const auth = new Auth({ reader: { ...await passwordHash('test-only-password'), totpSecret: secret, role: 'reader' } }, store, { now: () => now });
 const otp = () => new TOTP({ secret }).generate({ timestamp: now });
 expect(await auth.login('reader', 'wrong', otp(), 'a')).toBe(null);
 expect(await auth.login('reader', 'test-only-password', '000000', 'a')).toBe(null);
 const token = await auth.login('reader', 'test-only-password', otp(), 'a'); expect(auth.get(token).role).toBe('reader');
 expect(await auth.login('reader', 'test-only-password', otp(), 'b')).toBe(null);
 auth.logout(token); expect(auth.get(token)).toBe(null);
 now += 31000; const next = await auth.login('reader', 'test-only-password', otp(), 'b'); expect(next).toBeTruthy(); now += 1800001; expect(auth.get(next)).toBe(null); store.close();
});
it('deduplicates events and rejects a producer claiming another topic; hides security events from readers', () => {
 const store = new EventStore(), e = operationalEvent('rh-game-01', 'connection.opened');
 expect(store.add(e, 'rh.rh-game-01.lifecycle.v1')).toBe(1); expect(store.add(e)).toBe(0);
 expect(() => store.add(e, 'rh.rh-game-02.lifecycle.v1')).toThrow();
 store.add(operationalEvent('rh-gateway', 'security.rejected', { reason: 'rate' }));
 expect(store.events(0)).toHaveLength(1); expect(store.events(0, true)).toHaveLength(2); store.close();
});
it('bounds metric cardinality and emits zero-valued histogram buckets', () => {
 const m = new Metrics(2); m.set('rh_test', 1, { player: 'secret' }); expect(m.snapshot()).toHaveLength(0);
 for (let i = 0; i < 100; i++) m.set('rh_test', i, { peer: String(i) }); expect(m.snapshot()).toHaveLength(2);
 const h = new Metrics(); h.observe('rh_latency_ms', 50); expect(prometheus(h.snapshot(), 'rh-game-01')).toContain('le="1"} 0');
});
it('protects panel APIs with server-side roles, MFA, origin checks and read-only access', async () => {
 const users = { reader: { ...await passwordHash('test-only-password'), totpSecret: secret, role: 'reader' } };
 const panel = await createPanel({ development: true, origin: 'http://127.0.0.1', port: 0, metricsPort: 0, prometheus: 'http://127.0.0.1:1', users, nodes: [] });
 const base = `http://127.0.0.1:${panel.server.address().port}`;
 try {
  expect((await fetch(base + '/ops/api/overview')).status).toBe(401);
  const headers = { 'content-type': 'application/json', origin: 'http://evil.invalid' }, body = JSON.stringify({ username: 'reader', password: 'test-only-password', otp: new TOTP({ secret }).generate() });
  expect((await fetch(base + '/ops/api/login', { method: 'POST', headers, body })).status).toBe(403);
  headers.origin = 'http://127.0.0.1'; const login = await fetch(base + '/ops/api/login', { method: 'POST', headers, body }); expect(login.status).toBe(200);
  const cookie = login.headers.get('set-cookie'); expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict'); headers.cookie = cookie.split(';')[0];
  expect((await fetch(base + '/ops/api/overview', { headers })).status).toBe(200);
  expect((await fetch(base + '/ops/api/security', { headers })).status).toBe(403);
  expect((await fetch(base + '/ops/api/overview', { headers, method: 'DELETE' })).status).toBe(405);
  expect((await fetch(base + '/ops/api/history?metric=arbitrary&seconds=300', { headers })).status).toBe(400);
 } finally { await panel.close(); }
});
it('emits one room closure with measured duration and an internal identifier', async () => {
 const { RoomManager } = await import('../server/RoomManager.js'); let now = 1000; const events = [];
 const manager = new RoomManager({ now: () => now, send() {}, telemetry: { emit: (type,data) => events.push({ type,data }) } });
 const { room, member } = manager.create({}, 'test'); now += 2500; manager.disconnect(room, member, true); manager.retire(room);
 expect(events.map(e => e.type)).toEqual(['room.created','room.closed']); expect(events[1].data.durationSeconds).toBe(2.5); expect(events[1].data.roomId).toBe(events[0].data.roomId); expect(JSON.stringify(events)).not.toContain(room.code);
});

it('allows explicitly configured password-only access while rejecting invalid passwords', async () => {
 const store = new EventStore(), users = { reader: { ...await passwordHash('test-only-password'), role: 'reader' } };
 expect(() => new Auth(users, store)).toThrow();
 const auth = new Auth(users, store, { requireMfa: false });
 expect(await auth.login('reader', 'wrong', undefined, 'a')).toBe(null);
 const token = await auth.login('reader', 'test-only-password', undefined, 'a'); expect(auth.get(token).role).toBe('reader');
 const panel = await createPanel({ development: true, requireMfa: false, origin: 'http://127.0.0.1', port: 0, metricsPort: 0, prometheus: 'http://127.0.0.1:1', users, nodes: [] });
 try { const html = await (await fetch(`http://127.0.0.1:${panel.server.address().port}/ops/`)).text(); expect(html).not.toContain('name="otp"'); } finally { await panel.close(); store.close(); }
});
