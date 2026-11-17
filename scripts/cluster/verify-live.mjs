// Isolated candidate only: deliberately stops cluster services, never the legacy backend.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup } from 'node:dns/promises';
import { WebSocket } from 'ws';
import { resolver, assertNoPublicClusterTraffic } from '../lib/smoke-network.mjs';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../src/network/protocol.js';
const exec = promisify(execFile), inventory = JSON.parse(readFileSync('.cluster-local/inventory.json', 'utf8'));
if (process.env.RH_CLUSTER_TEST_ISOLATED !== '1' || process.env.SMOKE_RESOLVE_IP !== inventory.nodes['rh-gateway'].publicIp) throw new Error('Explicit isolated candidate required');
if ((await lookup('redhorizon.lat')).address === process.env.SMOKE_RESOLVE_IP) throw new Error('Refusing fault injection against the DNS production destination');
await assertNoPublicClusterTraffic();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
async function until(fn, timeout = 10000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = fn(); if (value) return value; await delay(50); } throw new Error('Live check timeout'); }
async function aws(args) { const { stdout } = await exec('aws', [...args, '--region', 'us-east-2', '--profile', 'rh-cluster-operator', '--output', 'json', '--no-cli-pager']); return JSON.parse(stdout); }
async function control(name, command) {
  const instance = inventory.nodes[name].instanceId;
  const { Command } = await aws(['ssm', 'send-command', '--instance-ids', instance, '--document-name', 'AWS-RunShellScript', '--parameters', JSON.stringify({ commands: [command] })]);
  for (let i = 0; i < 30; i++) {
    await delay(1000); let response;
    try { response = await aws(['ssm', 'get-command-invocation', '--command-id', Command.CommandId, '--instance-id', instance]); } catch { continue; }
    if (response.Status === 'Success') return response.StandardOutputContent;
    if (!['Pending', 'InProgress', 'Delayed'].includes(response.Status)) throw new Error('Service control failed: ' + name);
  } throw new Error('SSM control timeout');
}
const sockets = [], checks = []; let coordinatorStopped = false, workerStopped = false, drained = false;
async function connect(serverId = '') {
  const ws = new WebSocket(`wss://redhorizon.lat/ws${serverId ? '?server=' + serverId : ''}`, { lookup: resolver(), origin: 'https://redhorizon.lat', handshakeTimeout: 5000 });
  sockets.push(ws); ws.messages = [];
  ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'snapshot') ws.snapshot = m; else ws.messages.push(m); });
  ws.on('error', () => {});
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); return ws;
}
const send = (ws, message) => ws.send(JSON.stringify(message));
const intro = type => ({ type, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION });
const message = (ws, type) => until(() => ws.messages.find(m => m.type === type));
try {
  const rooms = [];
  for (let i = 0; i < 3; i++) {
    const a = await connect(); send(a, intro('create')); const welcome = await message(a, 'welcome');
    const b = await connect(); send(b, { ...intro('join'), code: welcome.code }); const second = await message(b, 'welcome');
    assert(second.serverId === welcome.serverId, 'Room was split across workers'); rooms.push({ a, b, welcome });
  }
  assert(new Set(rooms.map(r => r.welcome.serverId)).size === 3, 'Not distributed over three workers'); checks.push('three distinct workers; two clients per room pinned');
  coordinatorStopped = true; await control('rh-coordinator', 'systemctl stop redhorizon-cluster');
  const room = rooms[0]; send(room.b, { type: 'ping', at: 101 }); await message(room.b, 'pong');
  room.a.terminate(); await delay(500);
  const recovered = await connect(room.welcome.serverId); send(recovered, { ...intro('reconnect'), code: room.welcome.code, token: room.welcome.token });
  const rejoined = await message(recovered, 'welcome'); assert(rejoined.playerId === room.welcome.playerId, 'Identity changed'); room.a = recovered;
  const blocked = await connect(); send(blocked, intro('create')); assert((await message(blocked, 'error')).code === 'UNAVAILABLE', 'Creation did not fail closed');
  checks.push('coordinator stopped: existing connections and hinted reconnect survive, creation fails closed');
  await control('rh-coordinator', 'systemctl start redhorizon-cluster'); coordinatorStopped = false;
  const doomed = rooms.find(r => r.welcome.serverId === 'rh-game-02');
  workerStopped = true; await control('rh-game-02', 'systemctl stop redhorizon-cluster');
  await until(() => doomed.a.readyState === WebSocket.CLOSED);
  await control('rh-game-02', 'systemctl start redhorizon-cluster'); workerStopped = false;
  await delay(17000);
  const lost = await connect('rh-game-02'); send(lost, { ...intro('reconnect'), code: doomed.welcome.code, token: doomed.welcome.token }); assert((await message(lost, 'error')).code === 'NOT_FOUND', 'Lost room incorrectly recovered');
  checks.push('worker restart loses only its own in-memory room and fences the previous incarnation');
  const retained = rooms.find(r => r.welcome.serverId === 'rh-game-03');
  drained = true; await control('rh-game-03', 'systemctl kill --kill-who=main --signal=SIGUSR1 redhorizon-cluster');
  await delay(6000); send(retained.a, { type: 'ping', at: 202 }); await message(retained.a, 'pong');
  const fresh = await connect(); send(fresh, intro('create')); const assignment = await message(fresh, 'welcome'); assert(assignment.serverId === 'rh-game-02', 'New room assigned to a draining worker');
  checks.push('draining preserves established connection and new room selects the available worker');
  for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) send(ws, { type: 'leave' });
  await delay(1000);
  await control('rh-game-03', 'systemctl restart redhorizon-cluster'); drained = false;
  const report = { result: 'passed', candidateIp: process.env.SMOKE_RESOLVE_IP,
    assignments: rooms.map(r => ({ code: r.welcome.code, worker: r.welcome.serverId, players: 2 })), checks, at: new Date().toISOString() };
  writeFileSync('.cluster-local/live-fault-checks.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  for (const ws of sockets) { if (ws.readyState === WebSocket.OPEN) send(ws, { type: 'leave' }); ws.close(); }
  if (coordinatorStopped) await control('rh-coordinator', 'systemctl start redhorizon-cluster');
  if (workerStopped || drained) await Promise.all(['rh-game-02', 'rh-game-03'].map(name => control(name, 'systemctl restart redhorizon-cluster')));
}
