// Calibration smoke on this workstation, NOT an EC2 capacity certification.
import { harness, hello, message, waitFor } from '../../tests/cluster/harness.js';
const h = await harness(); const sockets = [];
try {
  for (const w of h.workers) await w.report(1);
  for (let i = 0; i < 3; i++) {
    const a = await h.connect(); sockets.push(a); a.send(JSON.stringify(hello('create'))); const welcome = await message(a, 'welcome');
    const b = await h.connect(); sockets.push(b); b.send(JSON.stringify({ ...hello('join'), code: welcome.code })); await message(b, 'welcome');
    a.send(JSON.stringify({ type: 'ready', ready: true })); b.send(JSON.stringify({ type: 'ready', ready: true }));
    const owner = h.workers.find(w => w.id === welcome.serverId);
    await waitFor(() => [...owner.app.manager.find(welcome.code).members.values()].every(m => m.ready)); a.send(JSON.stringify({ type: 'start' })); await message(a, 'snapshot');
  }
  const start = performance.now(); const rtts = [];
  for (let sample = 0; sample < 20; sample++) {
    const socket = sockets[sample % sockets.length]; const at = performance.now();
    socket.send(JSON.stringify({ type: 'ping', at })); await waitFor(() => socket.messages.some(m => m.type === 'pong' && m.at === at));
    rtts.push(performance.now() - at); await new Promise(resolve => setTimeout(resolve, 500));
  }
  rtts.sort((a,b) => a-b);
  console.log(JSON.stringify({ scope: 'local three workers, six clients, no production traffic', durationMs: performance.now()-start, clientRttP95Ms: rtts[Math.ceil(rtts.length*.95)-1], pollingResolutionMs:20, workers: h.workers.map(w => ({ id:w.id,...w.app.status() })) }, null, 2));
} finally { await h.close(); }
