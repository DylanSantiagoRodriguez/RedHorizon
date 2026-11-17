import { nginxMetrics } from './nginx-metrics.js';
import https from 'node:https';
import http from 'node:http';
import { readFile, mkdir, chmod, unlink, statfs } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Metrics, prometheus } from './metrics.js';
import { EventQueue } from './events.js';
import { producerTransport, validEvent } from './kafka.js';
const exec = promisify(execFile);
export async function hostMetrics(metrics, { procRoot = '/proc', disk = '/', service = 'redhorizon-cluster' } = {}) {
  const [mem, cpu, network, storage] = await Promise.all([readFile(`${procRoot}/meminfo`, 'utf8'), readFile(`${procRoot}/stat`, 'utf8'), readFile(`${procRoot}/net/dev`, 'utf8'), statfs(disk)]);
  const memory = Object.fromEntries([...mem.matchAll(/^(\w+):\s+(\d+)/gm)].map(m => [m[1], Number(m[2]) * 1024]));
  metrics.set('rh_host_memory_total_bytes', memory.MemTotal); metrics.set('rh_host_memory_available_bytes', memory.MemAvailable);
  const ticks = cpu.split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  metrics.set('rh_host_cpu_total_ticks', ticks.slice(0, 8).reduce((a, b) => a + b, 0)); metrics.set('rh_host_cpu_idle_ticks', ticks[3] + ticks[4]);
  let received = 0, sent = 0;
  for (const line of network.split('\n').slice(2)) { const [nic, counters] = line.split(':'); if (!counters || !/^(eth\d+|ens\d+|enp[\w]+)$/.test(nic.trim())) continue; const values = counters.trim().split(/\s+/).map(Number); received += values[0]; sent += values[8]; }
  metrics.set('rh_host_network_received_bytes_total', received); metrics.set('rh_host_network_sent_bytes_total', sent);
  metrics.set('rh_host_disk_total_bytes', storage.blocks * storage.bsize); metrics.set('rh_host_disk_available_bytes', storage.bavail * storage.bsize);
  try { const { stdout } = await exec('systemctl', ['show', service, '-p', 'ActiveState', '-p', 'NRestarts'], { timeout: 1500, maxBuffer: 4096 }); metrics.set('rh_service_up', Number(stdout.includes('ActiveState=active'))); metrics.set('rh_service_restarts_total', Number(stdout.match(/NRestarts=(\d+)/)?.[1] || 0)); }
  catch { metrics.set('rh_service_up', 0); }
}
export async function createAgent(config) {
  if (!/^rh-(gateway|game-0[123]|coordinator|observability|events)$/.test(config.id)) throw new Error('Invalid node');
  const nginxSample = config.nginxLog ? nginxMetrics(config.nginxLog) : null;
  const metrics = new Metrics(), transport = config.transport || producerTransport(config.kafka);
  const queue = new EventQueue({ send: transport.send, timeoutMs: 2500, capacity: 256, batchSize: 32 });
  if (config.revisionFile) { const manifest = JSON.parse(await readFile(config.revisionFile, 'utf8')); if (['rh-events', 'rh-observability'].includes(config.id)) { queue.publish(config.id, 'deployment.changed', { revision: manifest.commit }); metrics.set('rh_service_build_info', 1, { revision: manifest.commit }); } }
  let appRows = [], lastApp = 0, busy = false, certificatesAt = 0;
  const socketPath = config.socketPath || '/run/redhorizon-observer/ingest.sock';
  await mkdir(socketPath.slice(0, socketPath.lastIndexOf('/')), { recursive: true, mode: 0o750 });
  await unlink(socketPath).catch(e => { if (e.code !== 'ENOENT') throw e; });
  const ingest = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.url !== '/ingest') return res.writeHead(404).end();
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 131072) { res.writeHead(413).end(); req.destroy(); return; } chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks));
      if (body.source !== config.id || !Array.isArray(body.events) || body.events.length > 32 || !Array.isArray(body.metrics) || body.metrics.length > 512) throw new Error('Invalid report');
      const accepted = new Metrics();
      for (const row of body.metrics) if (/^rh_(game_|gateway_|coordinator_|application_|process_|tls_|handshake_|websocket_|collector_)/.test(row.name)) accepted.set(row.name, row.value, row.labels);
      appRows = accepted.snapshot(); lastApp = Date.now();
      for (const raw of body.events) { try { const event = validEvent(raw); if (event.source !== config.id) throw new Error('Source'); if (queue.items.length < queue.capacity) queue.items.push(event); else queue.dropped++; } catch { metrics.inc('rh_events_invalid_total'); } }
      res.writeHead(202).end();
    } catch { res.writeHead(400).end(); }
  });
  ingest.requestTimeout = 2000;
  await new Promise(resolve => ingest.listen(socketPath, resolve)); await chmod(socketPath, 0o660);
  const tls = { ca: await readFile(`${config.tlsDir}/ca.crt`), cert: await readFile(`${config.tlsDir}/${config.id}.crt`), key: await readFile(`${config.tlsDir}/${config.id}.key`) };
  metrics.set('rh_certificate_expires_seconds', Date.parse(new X509Certificate(tls.cert).validTo) / 1000);
  const server = https.createServer({ ...tls, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, (req, res) => {
    if (!req.socket.authorized || req.socket.getPeerCertificate().subject.CN !== 'rh-observability') return res.writeHead(403).end();
    if (req.url !== '/metrics') return res.writeHead(404).end();
    metrics.set('rh_application_report_timestamp_seconds', lastApp / 1000);
    if (transport.stats) { metrics.set('rh_kafka_produced_events_total', transport.stats.events); metrics.set('rh_kafka_produced_bytes_total', transport.stats.bytes); metrics.set('rh_kafka_last_send_timestamp_seconds', transport.stats.lastSentAt / 1000); metrics.set('rh_kafka_producer_errors_total', transport.stats.errors); }
    metrics.set('rh_events_pending', queue.items.length); metrics.set('rh_events_dropped_total', queue.dropped); metrics.set('rh_events_delivered_total', queue.delivered);
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' }); res.end(prometheus([...metrics.snapshot(), ...(Date.now() - lastApp <= 15000 ? appRows : [])], config.id));
  });
  server.on('tlsClientError', () => metrics.inc('rh_exporter_tls_failures_total'));
  server.maxConnections = 8; server.requestTimeout = 2000; server.headersTimeout = 2000;
  await new Promise(resolve => server.listen(config.port || 9400, config.host, resolve));
  const sample = async () => { if (busy) return; busy = true; try { await (config.sample || hostMetrics)(metrics, config); if (nginxSample) await nginxSample(metrics); if (Date.now() - certificatesAt > 60000) { for (const item of (config.certificates || []).slice(0, 8)) { try { const cert = new X509Certificate(await readFile(item.path)); metrics.set('rh_certificate_named_expires_seconds', Date.parse(cert.validTo) / 1000, { endpoint: item.purpose }); } catch { metrics.inc('rh_certificate_read_errors_total', 1, { endpoint: item.purpose }); } } certificatesAt = Date.now(); } metrics.set('rh_host_sample_timestamp_seconds', Date.now() / 1000); } catch { metrics.inc('rh_host_sample_errors_total'); } finally { busy = false; } };
  await sample(); const timer = setInterval(sample, 5000), flush = setInterval(() => { void queue.flush(); }, 2000); timer.unref(); flush.unref();
  return { server, ingest, metrics, queue, close: async () => { clearInterval(timer); clearInterval(flush); await Promise.all([new Promise(r => { server.closeAllConnections(); server.close(r); }), new Promise(r => { ingest.closeAllConnections(); ingest.close(r); })]); await transport.close(); await unlink(socketPath).catch(() => {}); } };
}
if (process.argv[1]?.endsWith('/agent.js')) {
  const config = JSON.parse(await readFile(process.env.RH_OBSERVER_CONFIG, 'utf8'));
  const app = await createAgent(config);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
