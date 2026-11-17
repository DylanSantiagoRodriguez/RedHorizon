// Workstation comparison only, not EC2 capacity certification. Runs without AWS.
import { writeFileSync } from 'node:fs';
import { Telemetry } from '../../server/observability/telemetry.js';
import { harness, hello, message, waitFor } from '../../tests/cluster/harness.js';
const runs = [];
for (const enabled of [false, true, false, true]) {
 const telemetry = Object.fromEntries((enabled ? ['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator'] : []).map(id => [id, new Telemetry(id, { socketPath: '/tmp/rh-observer-intentionally-unavailable.sock' })]));
 const h = await harness({ telemetry }), clients = [];
 try {
  for (const t of Object.values(telemetry)) t.start();
  for (let i = 0; i < 3; i++) {
   const a = await h.connect(); a.send(JSON.stringify(hello('create'))); const w = await message(a, 'welcome'); const b = await h.connect(); b.send(JSON.stringify({ ...hello('join'), code: w.code })); await message(b, 'welcome'); clients.push(a,b);
   a.send(JSON.stringify({ type: 'ready', ready: true })); b.send(JSON.stringify({ type: 'ready', ready: true })); const owner = h.workers.find(x => x.id === w.serverId); await waitFor(() => [...owner.app.manager.find(w.code).members.values()].every(m => m.ready)); a.send(JSON.stringify({ type: 'start' })); await message(a, 'snapshot');
  }
  const at = performance.now(), cpu = process.cpuUsage(), rtts = [];
  for (let i = 0; i < 24; i++) {
   const socket = clients[i % clients.length], sent = performance.now();
   await new Promise((resolve, reject) => { const timer = setTimeout(() => { socket.off('message', listen); reject(new Error('Game stopped')); }, 2000); const listen = raw => { const m = JSON.parse(raw); if (m.type === 'pong' && m.at === sent) { clearTimeout(timer); socket.off('message', listen); rtts.push(performance.now() - sent); resolve(); } }; socket.on('message', listen); socket.send(JSON.stringify({ type: 'ping', at: sent })); });
   await new Promise(r => setTimeout(r, 250));
  }
  rtts.sort((a,b) => a-b); const used = process.cpuUsage(cpu), elapsed = performance.now() - at;
  runs.push({ telemetryEnabled: enabled, collectorAvailable: false, elapsedMs: elapsed, processCPUPercent: (used.user + used.system) / (elapsed * 10), applicationRTTp50Ms: rtts[11], applicationRTTp95Ms: rtts[22], workers: h.workers.map(w => ({ id: w.id, ...w.app.status() })), droppedEvents: Object.values(telemetry).reduce((n,t) => n + t.events.dropped, 0) });
 } finally { for (const t of Object.values(telemetry)) t.close(); await h.close(); }
}
const result = { scope: 'Same workstation process, 3 workers / 6 clients; alternating baseline and enabled telemetry with unavailable collectors. No EC2 claim.', runs };
writeFileSync('.cluster-local/observability/benchmark.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
