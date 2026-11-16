import { beforeAll, afterAll, it, expect } from 'vitest';
import { harness, hello, message, waitFor } from './cluster/harness.js';
import { Limiter } from '../server/cluster/limiter.js';
let h;
beforeAll(async () => { h = await harness(); }, 30000);
afterAll(async () => { await h?.close(); }, 15000);
it('does not overbook reservations, expires abandoned reservations, and rejects replay', async () => {
  const r = await h.gatewayApi('/reserve', {}), owner = h.workers.find(w => w.id === r.worker);
  const args = { id: owner.id, boot: owner.boot, code: r.code, token: r.token };
  expect(await h.coord.execute('activate', args)).toEqual({ ok: true });
  expect((await h.coord.execute('activate', args)).error).toBe('UNAVAILABLE');
  const abandoned = await h.gatewayApi('/reserve', {});
  const state = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state.rooms[abandoned.code].expires = 0; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state));
  expect((await h.coord.execute('activate', { id: abandoned.worker, boot: h.workers.find(w => w.id === abandoned.worker).boot, code: abandoned.code, token: abandoned.token })).error).toBe('UNAVAILABLE');
});
it('keeps legitimate traffic flowing while dropping a flooding client', async () => {
  const good = await h.connect(); good.send(JSON.stringify(hello('create'))); await message(good, 'welcome');
  const bad = await h.connect(); bad.send(JSON.stringify(hello('create'))); await message(bad, 'welcome');
  for (let i = 0; i < 160; i++) bad.send(JSON.stringify({ type: 'ping', at: i }));
  await waitFor(() => bad.readyState === 3);
  good.send(JSON.stringify({ type: 'ping', at: 42 })); expect((await message(good, 'pong')).at).toBe(42);
  good.send(JSON.stringify({ type: 'leave' })); await waitFor(() => good.readyState === 3);
});
it('drains existing rooms without interrupting them, then observes worker failure', async () => {
  const a = await h.connect(); a.send(JSON.stringify(hello('create'))); const welcome = await message(a, 'welcome');
  const owner = h.workers.find(w => w.id === welcome.serverId);
  owner.app.drain(); await owner.report();
  a.send(JSON.stringify({ type: 'ping', at: 88 })); expect((await message(a, 'pong')).at).toBe(88);
  const assigned = await h.gatewayApi('/reserve', {}); expect(assigned.worker).not.toBe(owner.id);
  await owner.app.close(); await waitFor(() => a.readyState === 3);
  const state = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state.workers[owner.id].seen = 0; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state));
  await expect(h.gatewayApi('/lookup', { code: welcome.code })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
});
it('refuses concurrent incarnations and fences a retired incarnation permanently', async () => {
  const id = 'rh-game-03', boot = h.workers[2].boot;
  expect((await h.coord.execute('heartbeat', { id, boot: 'other', capacity: 1, load: 0, rooms: [], draining: false })).error).toBe('ACTIVE');
  const state = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state.workers[id].seen = 0; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state));
  expect(await h.coord.execute('heartbeat', { id, boot: 'other', capacity: 1, load: 0, rooms: [], draining: false })).toEqual({ ok: true });
  const state2 = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state2.workers[id].seen = 0; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state2));
  expect((await h.coord.execute('heartbeat', { id, boot, capacity: 1, load: 0, rooms: [], draining: false })).error).toBe('ACTIVE');
});
it('bounds limiter memory and replenishes budgets independently', () => {
  let now = 0; const limiter = new Limiter(2, () => now);
  expect(limiter.take('a', 1, 1)).toBe(true); expect(limiter.take('a', 1, 1)).toBe(false);
  expect(limiter.take('b', 1, 1)).toBe(true); expect(limiter.take('c', 1, 1)).toBe(false);
  now = 1000; expect(limiter.take('a', 1, 1)).toBe(true);
  now = 123000; expect(limiter.take('c', 1, 1)).toBe(true); expect(limiter.buckets.size).toBe(1);
});

it('keeps an active code reserved through a coordinator outage and restores its lease', async () => {
  await h.coord.redis.del('rh:directory:v1');
  const owner = h.workers[1];
  await owner.api('/heartbeat', { boot: owner.boot, capacity: 1, load: 0, draining: false, rooms: [] });
  const r = await h.gatewayApi('/reserve', {});
  await owner.api('/activate', { boot: owner.boot, code: r.code, token: r.token });
  const state = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state.rooms[r.code].expires = 0; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state));
  await expect(h.gatewayApi('/lookup', { code: r.code })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect((await h.coord.execute('reserve', { code: r.code, token: 'another' })).error).toBe('COLLISION');
  await owner.api('/heartbeat', { boot: owner.boot, capacity: 1, load: 0, draining: false, rooms: [r.code] });
  expect((await h.gatewayApi('/lookup', { code: r.code })).worker).toBe(owner.id);
});
