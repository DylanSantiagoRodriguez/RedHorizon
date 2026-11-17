import { Telemetry } from '../observability/telemetry.js';
import { readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from '../server.js';
import { createGateway } from './gateway.js';
import { createCoordinator } from './coordinator.js';
import { apiClient, tlsFiles } from './transport.js';
const config = JSON.parse(readFileSync(process.env.RH_CLUSTER_CONFIG || '/etc/redhorizon/cluster.json', 'utf8'));
const tls = tlsFiles(config.tlsDir, config.id);
// Production artifacts always carry the revision; health must identify that artifact.
const releasePath = new URL('../../release.json', import.meta.url);
if (existsSync(releasePath)) config.buildId = JSON.parse(readFileSync(releasePath, 'utf8')).commit;
else if (process.env.NODE_ENV === 'production') throw new Error('Missing release manifest');
const telemetry = config.observability ? new Telemetry(config.id, config.observability) : null;
let app, api, heartbeat, reportWorker, reporting = false;
if (config.id === 'rh-coordinator') app = await createCoordinator({ telemetry, tls, redisUrl: config.redisUrl, workers: config.workers, host: config.host, port: config.port });
else {
  api = apiClient(config.coordinator, tls, telemetry);
  if (config.id === 'rh-gateway') app = createGateway({ ...config, telemetry, tls, coordinator: api });
  else {
    if (!/^rh-game-0[123]$/.test(config.id) || !Number.isInteger(config.capacity) || config.capacity < 0 || config.capacity > 256) throw new Error('Explicit measured capacity required');
    const boot = randomUUID();
    app = createServer({ ...config, telemetry, maxRooms: Math.max(1, config.capacity), cluster: { id: config.id, tls, admit: async (code, token) => { await api('/activate', { code, token, boot }); return code; } } });
    const report = async () => {
      if (reporting) return; reporting = true;
      if (existsSync(config.drainFile || '/var/lib/redhorizon-cluster/drain')) app.drain();
      const metrics = app.status();
      for (const key of ['rooms', 'players', 'messages', 'rejected', 'bytesIn', 'bytesOut', 'stepMeanMs', 'stepMaxMs', 'eventLoopP99Ms', 'cpu', 'rss', 'load']) telemetry?.metrics.set('rh_game_' + key.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), metrics[key]);
      telemetry?.metrics.set('rh_game_draining', Number(metrics.draining)); telemetry?.metrics.set('rh_game_capacity', config.capacity);
      try { await api('/heartbeat', { boot, capacity: config.capacity, draining: metrics.draining, load: metrics.load, rooms: [...app.manager.rooms.keys()] }); }
      catch { /* Existing games keep running. New allocations fail after lease expiry. */ }
      const record = { event: 'worker_metrics', id: config.id, boot, recordedAt: Date.now(), listening: app.server.listening, ...metrics };
      if (config.statusFile) { writeFileSync(`${config.statusFile}.next`, JSON.stringify(record), { mode: 0o600 }); renameSync(`${config.statusFile}.next`, config.statusFile); }
      console.log(JSON.stringify(record)); reporting = false;
    };
    reportWorker = report;
  }
}
await app.listen();
telemetry?.emit('deployment.changed', { revision: config.buildId });
telemetry?.start(() => app.sample?.());
if (reportWorker) { await reportWorker(); heartbeat = setInterval(reportWorker, 5000); }
console.log(JSON.stringify({ event: 'listening', id: config.id, buildId: config.buildId }));
process.on('SIGUSR1', () => app.drain?.());
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (stopping) return; stopping = true; app.drain?.(); telemetry?.close(); clearInterval(heartbeat);
  await app.close(); api?.close(); process.exit(0);
});
