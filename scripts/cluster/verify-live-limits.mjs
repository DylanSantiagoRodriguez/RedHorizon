// Bounded isolation test: a single abusive session alongside a legitimate one.
import { readFileSync, writeFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { WebSocket } from 'ws';
import { resolver, assertNoPublicClusterTraffic } from '../lib/smoke-network.mjs';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../src/network/protocol.js';
const nodes = JSON.parse(readFileSync('.cluster-local/inventory.json')).nodes;
if (process.env.RH_CLUSTER_TEST_ISOLATED !== '1' || process.env.SMOKE_RESOLVE_IP !== nodes['rh-gateway'].publicIp || (await lookup('redhorizon.lat')).address === process.env.SMOKE_RESOLVE_IP) throw new Error('Isolated candidate required');
await assertNoPublicClusterTraffic();
const sockets = [], checks = [], delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { const value = fn(); if (value) return value; await delay(50); } throw new Error('Limit test timeout'); }
async function connect() {
  const ws = new WebSocket('wss://redhorizon.lat/ws', { lookup: resolver(), origin: 'https://redhorizon.lat' }); sockets.push(ws); ws.messages = [];
  ws.on('error', () => {}); ws.on('message', raw => ws.messages.push(JSON.parse(raw)));
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); return ws;
}
const send = (s, m) => s.send(JSON.stringify(m));
try {
  const good = await connect(); send(good, { type: 'create', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION }); await until(() => good.messages.find(m => m.type === 'welcome'));
  const bad = await connect(); send(bad, { type: 'create', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION }); await until(() => bad.messages.find(m => m.type === 'welcome'));
  for (let i = 0; i < 160; i++) send(bad, { type: 'ping', at: i });
  await until(() => bad.readyState === WebSocket.CLOSED);
  if (!bad.messages.some(m => m.code === 'LIMIT')) throw new Error('Flood was not limited');
  send(good, { type: 'ping', at: 999 }); await until(() => good.messages.find(m => m.type === 'pong' && m.at === 999)); checks.push('150 messages/s limit isolates abusive session; legitimate session remains responsive');
  const huge = await connect(); huge.send('x'.repeat(5000)); const code = await new Promise(resolve => huge.once('close', resolve));
  if (code !== 1009) throw new Error('Oversized frame was not rejected'); checks.push('decompressed message size capped at 4096 bytes');
  send(good, { type: 'ping', at: 1000 }); await until(() => good.messages.find(m => m.type === 'pong' && m.at === 1000));
  const result = { at: new Date().toISOString(), result: 'passed', checks }; writeFileSync('.cluster-local/live-limits.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { for (const ws of sockets) { if (ws.readyState === WebSocket.OPEN) send(ws, { type: 'leave' }); ws.close(); } }
