import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { createCoordinator } from '../../server/cluster/coordinator.js';
import { createGateway } from '../../server/cluster/gateway.js';
import { createServer } from '../../server/server.js';
import { tlsFiles, apiClient } from '../../server/cluster/transport.js';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../src/network/protocol.js';
export const hello = type => ({ type, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function waitFor(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { const value = fn(); if (value) return value; await delay(20); } throw new Error('Condition timeout'); }
export async function harness({ origin = 'http://127.0.0.1:5173', gatewayPort = 0 } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'rh-cluster-'));
  const keyRoot = process.platform === 'darwin' ? '/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon' : join(tmpdir(), 'rh-test-keys');
  const keyDir = `${keyRoot}/test-${randomUUID()}`;
  const names = ['rh-gateway', 'rh-coordinator', 'rh-game-01', 'rh-game-02', 'rh-game-03'];
  writeFileSync(join(temp, 'hosts.json'), JSON.stringify(Object.fromEntries(names.map(n => [n, '127.0.0.1']))));
  execFileSync('python3', ['scripts/cluster/pki.py', keyDir, '--hosts', join(temp, 'hosts.json')], { env: { ...process.env, RH_KEY_ROOT: keyRoot } });
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve)); const redisPort = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const redis = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(redisPort), '--save', '', '--appendonly', 'no', '--dir', temp], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Redis startup timeout')), 5000); redis.once('error', reject); redis.stdout.on('data', data => { if (data.toString().includes('Ready to accept connections')) { clearTimeout(timeout); resolve(); } }); });
  const coord = await createCoordinator({ tls: tlsFiles(keyDir, 'rh-coordinator'), redisUrl: `redis://127.0.0.1:${redisPort}`, workers: names.slice(2), port: 0 });
  const address = await coord.listen(), endpoint = `https://127.0.0.1:${address.port}`;
  const gatewayApi = apiClient(endpoint, tlsFiles(keyDir, 'rh-gateway'));
  const workers = [], urls = {}, sockets = [];
  for (const id of names.slice(2)) {
    const api = apiClient(endpoint, tlsFiles(keyDir, id)), boot = randomUUID();
    const app = createServer({ port: 0, origins: [origin], cluster: { id, tls: tlsFiles(keyDir, id), admit: async (code, token) => { await api('/activate', { code, token, boot }); return code; } } });
    const a = await app.listen(); urls[id] = `wss://127.0.0.1:${a.port}/ws`;
    const report = (capacity = 2) => api('/heartbeat', { boot, capacity, load: 0, draining: app.status().draining, rooms: [...app.manager.rooms.keys()] });
    await report(); workers.push({ id, app, api, boot, report });
  }
  const gateway = createGateway({ coordinator: gatewayApi, workers: urls, tls: tlsFiles(keyDir, 'rh-gateway'), origins: [origin], port: gatewayPort });
  const ga = await gateway.listen();
  const connect = async (serverId = '') => {
    const s = new WebSocket(`ws://127.0.0.1:${ga.port}/ws${serverId ? `?server=${serverId}` : ''}`, { origin }); sockets.push(s); s.messages = [];
    s.on('message', data => s.messages.push(JSON.parse(data))); s.on('error', () => {});
    await new Promise((resolve, reject) => { s.once('open', resolve); s.once('error', reject); }); return s;
  };
  return { coord, endpoint, keyDir, gateway, gatewayApi, workers, urls, connect,
    close: async () => { for (const s of sockets) s.terminate(); await gateway.close(); for (const w of workers) { await w.app.close(); w.api.close(); } gatewayApi.close(); await coord.close(); redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); rmSync(temp, { recursive: true, force: true }); rmSync(keyDir, { recursive: true, force: true }); } };
}
export async function message(socket, type) { return waitFor(() => socket.messages.find(m => m.type === type)); }
