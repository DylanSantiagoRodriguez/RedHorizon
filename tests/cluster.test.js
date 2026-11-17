import { beforeAll, afterAll, expect, it } from 'vitest';
import https from 'node:https';
import { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { harness, hello, message, waitFor } from './cluster/harness.js';
import { tlsFiles, apiClient } from '../server/cluster/transport.js';
let h;
beforeAll(async () => { h = await harness(); }, 30000);
afterAll(async () => { await h?.close(); }, 15000);
it('accepts generated service identities with strict X.509 validation', async () => {
  const script = `import http.client,ssl,sys
context=ssl.create_default_context(cafile=sys.argv[1]+'/ca.crt')
context.verify_flags |= ssl.VERIFY_X509_STRICT
context.load_cert_chain(sys.argv[1]+'/rh-gateway.crt',sys.argv[1]+'/rh-gateway.key')
connection=http.client.HTTPSConnection('127.0.0.1',int(sys.argv[2]),context=context,timeout=3)
connection.request('POST','/lookup',body='{}',headers={'Content-Type':'application/json'})
assert connection.getresponse().status==400
connection.close()
print('strict mTLS verified')`;
  const { stdout } = await promisify(execFile)('python3', ['-c', script, h.keyDir, new URL(h.endpoint).port]);
  expect(stdout.trim()).toBe('strict mTLS verified');
});
it('routes multiple rooms to distinct workers, pins two players, and reconnects during coordinator outage', async () => {
  const a = await h.connect(); a.send(JSON.stringify(hello('create'))); const wa = await message(a, 'welcome');
  expect(a.extensions).toContain('permessage-deflate');
  const b = await h.connect(); b.send(JSON.stringify({ ...hello('join'), code: wa.code })); const wb = await message(b, 'welcome');
  expect(wb.serverId).toBe(wa.serverId); expect(wb.code).toBe(wa.code);
  const c = await h.connect(); c.send(JSON.stringify(hello('create'))); const wc = await message(c, 'welcome'); expect(wc.serverId).not.toBe(wa.serverId);
  a.send(JSON.stringify({ type: 'ready', ready: true })); b.send(JSON.stringify({ type: 'ready', ready: true }));
  const owner = h.workers.find(w => w.id === wa.serverId);
  await waitFor(() => [...owner.app.manager.find(wa.code).members.values()].every(m => m.ready)); a.send(JSON.stringify({ type: 'start' }));
  await message(a, 'snapshot'); await message(b, 'snapshot'); expect(c.messages.some(m => m.type === 'snapshot')).toBe(false);
  // Make the coordinator unavailable without touching established WebSocket tunnels.
  const unavailable = h.gatewayApi;
  const original = h.gateway.server; expect(original.listening).toBe(true);
  // Redis disconnect makes every coordinator operation fail closed.
  h.coord.redis.destroy();
  a.send(JSON.stringify({ type: 'ping', at: 123 })); expect((await message(a, 'pong')).at).toBe(123);
  a.terminate(); await waitFor(() => owner.app.manager.find(wa.code).members.get(wa.playerId).socket === null);
  const recovered = await h.connect(wa.serverId); recovered.send(JSON.stringify({ ...hello('reconnect'), code: wa.code, token: wa.token }));
  expect((await message(recovered, 'welcome')).playerId).toBe(wa.playerId);
  const denied = await h.connect(); denied.send(JSON.stringify(hello('create'))); expect((await message(denied, 'error')).code).toBe('UNAVAILABLE');
  expect(unavailable).toBeDefined();
  await h.coord.redis.connect();
  for (const s of [b, c, recovered, denied]) s.terminate();
});
it('enforces mutual TLS and rejects worker impersonation and arbitrary routes', async () => {
  await expect(new Promise((resolve, reject) => { const req = https.request(`${h.endpoint}/lookup`, { ca: tlsFiles(h.keyDir, 'rh-gateway').ca, method: 'POST' }, resolve); req.on('error', reject); req.end('{}'); })).rejects.toThrow();
  const worker = apiClient(h.endpoint, tlsFiles(h.keyDir, 'rh-game-01'));
  await expect(worker('/reserve', {})).rejects.toThrow(); worker.close();
  await expect(h.connect('https://evil.invalid')).rejects.toThrow();
});
it('atomically caps concurrent reservations and fences restarted workers', async () => {
  // Isolate the directory from prior rooms for this storage-level concurrency test.
  await h.coord.redis.del('rh:directory:v1');
  for (const w of h.workers) await w.report(1);
  const reservations = await Promise.all(Array.from({ length: 20 }, (_, i) => h.coord.execute('reserve', { code: `AB${String(i).padStart(4, '2')}`, token: randomBytes(32).toString('hex') })));
  expect(reservations.filter(r => !r.error)).toHaveLength(3);
  const r = reservations.find(r => !r.error), owner = h.workers.find(w => w.id === r.worker);
  const state = JSON.parse(await h.coord.redis.get('rh:directory:v1')); state.workers[owner.id].seen -= 16000; await h.coord.redis.set('rh:directory:v1', JSON.stringify(state));
  await h.coord.execute('heartbeat', { id: owner.id, boot: 'new-incarnation', capacity: 1, draining: false, load: 0, rooms: [] });
  expect((await h.coord.execute('activate', { id: owner.id, boot: owner.boot, code: r.code, token: r.token })).error).toBe('UNAVAILABLE');
});
it('draining workers reject new creation while their existing process remains alive', async () => {
  await h.coord.redis.del('rh:directory:v1');
  for (const w of h.workers) { w.app.drain(); await w.report(1); }
  await expect(h.gatewayApi('/reserve', {})).rejects.toThrow();
  expect(h.workers.every(w => w.app.server.listening)).toBe(true);
});
it('denies direct worker access using a non-gateway service certificate', async () => {
  const socket = new WebSocket(h.urls['rh-game-01'], { ...tlsFiles(h.keyDir, 'rh-game-02'), origin: 'http://127.0.0.1:5173', headers: { 'x-real-ip': '127.0.0.1' } });
  await expect(new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); })).rejects.toThrow(); socket.terminate();
});
