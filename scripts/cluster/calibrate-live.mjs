// Controlled workload on the isolated candidate. This is an admission baseline,
// not a maximum-capacity claim or a DDoS test.
import { readFileSync, writeFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { WebSocket } from 'ws';
import { resolver } from '../lib/smoke-network.mjs';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../src/network/protocol.js';
const inventory = JSON.parse(readFileSync('.cluster-local/inventory.json', 'utf8'));
if (process.env.RH_CLUSTER_TEST_ISOLATED !== '1' || process.env.SMOKE_RESOLVE_IP !== inventory.nodes['rh-gateway'].publicIp || (await lookup('redhorizon.lat')).address === process.env.SMOKE_RESOLVE_IP) throw new Error('Isolated candidate required');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 10000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = fn(); if (value) return value; await delay(25); } throw new Error('Calibration timeout'); }
const sockets = [], rooms = [], rtts = [], failures = []; let inputTimer;
let logicalBytes = 0;
function send(ws, m) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); }
async function connect() {
  await delay(350); // Respect the candidate's handshake limiter.
  const ws = new WebSocket('wss://redhorizon.lat/ws', { lookup: resolver(), origin: 'https://redhorizon.lat' }); sockets.push(ws); ws.last = new Map(); ws.seq = 0; ws.maxEnemies = 0; ws.snapshots = 0;
  ws.on('error', error => failures.push(error.message));
  ws.on('message', raw => {
    logicalBytes += raw.length;
    const m = JSON.parse(raw); ws.last.set(m.type, m);
    if (m.type === 'snapshot') { ws.snapshots++; ws.maxEnemies = Math.max(ws.maxEnemies, m.enemies.length); }
    if (m.type === 'pong') rtts.push(performance.now() - m.at);
    if (m.type === 'error') failures.push(m.code);
  });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); return ws;
}
const intro = type => ({ type, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION });
try {
  for (let i = 0; i < 3; i++) {
    const a = await connect(); send(a, intro('create')); const welcome = await until(() => a.last.get('welcome'));
    const members = [a];
    for (let j = 0; j < 3; j++) { const b = await connect(); send(b, { ...intro('join'), code: welcome.code }); await until(() => b.last.get('welcome')); members.push(b); }
    for (const ws of members) send(ws, { type: 'ready', ready: true });
    await until(() => a.last.get('lobby')?.players.every(p => p.ready)); send(a, { type: 'start' }); await until(() => a.last.get('snapshot'));
    rooms.push({ serverId: welcome.serverId, members });
  }
  if (new Set(rooms.map(r => r.serverId)).size !== 3) throw new Error('Three workers not exercised');
  const start = performance.now();
  inputTimer = setInterval(() => {
    for (const [i, ws] of sockets.entries()) {
      const snapshot = ws.last.get('snapshot'), player = snapshot?.players.find(p => p.id === ws.last.get('welcome')?.playerId);
      if (!player) continue;
      if (snapshot.status === 'upgrade' && !player.chosen && player.upgrades.offers.length && ws.round !== snapshot.round) { ws.round = snapshot.round; send(ws, { type: 'upgrade', round: snapshot.round, option: player.upgrades.offers[0] }); }
      const yaw = (performance.now() - start) / 10000 + i * Math.PI / 2;
      const target = snapshot.enemies.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
      let dx = target ? target.x - player.x : -Math.sin(yaw), dz = target ? target.z - player.z : -Math.cos(yaw); const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
      send(ws, { type: 'input', seq: ++ws.seq, enabled: true, held: ['KeyW', 'ShiftLeft', 'Mouse0'], actions: ws.seq % 100 === 0 ? ['KeyQ'] : [], yaw, aim: { x: dx, y: 0, z: dz } });
      if (ws.seq % 20 === 0) send(ws, { type: 'ping', at: performance.now() });
    }
  }, 50);
  await delay(120000);
  clearInterval(inputTimer); inputTimer = null;
  rtts.sort((a, b) => a - b);
  const report = { at: new Date().toISOString(), durationSeconds: 120, logicalBytes, wireBytes: sockets.reduce((n, s) => n + (s._socket?.bytesRead || 0), 0), compression: sockets.map(s => s.extensions), rooms: rooms.map(r => ({ worker: r.serverId, players: r.members.length, maxEnemies: Math.max(...r.members.map(w => w.maxEnemies)), snapshots: r.members[0].snapshots, finalStatus: r.members[0].last.get('snapshot')?.status })), rttP95Ms: rtts[Math.floor(rtts.length * .95)], rttP99Ms: rtts[Math.floor(rtts.length * .99)], samples: rtts.length, connectedAtEnd: sockets.filter(s => s.readyState === WebSocket.OPEN).length, failures };
  writeFileSync('.cluster-local/live-calibration.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (failures.length || report.connectedAtEnd !== 12 || report.rttP95Ms > 400 || report.rttP99Ms > 800 || rooms.some(r => r.members.some(s => s.snapshots < 100))) throw new Error('Calibration acceptance failed');
} finally { clearInterval(inputTimer); for (const ws of sockets) { send(ws, { type: 'leave' }); ws.close(); } }
