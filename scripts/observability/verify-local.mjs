// Real isolated Kafka + Prometheus + three game processes + browser. No AWS calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { TOTP } from 'otpauth';
import { createAgent } from '../../server/observability/agent.js';
import { createPanel } from '../../server/observability/panel.js';
import { passwordHash } from '../../server/observability/auth.js';
import { Telemetry } from '../../server/observability/telemetry.js';
import { kafkaClient, producerTransport, topicFor } from '../../server/observability/kafka.js';
import { operationalEvent } from '../../server/observability/events.js';
import { tlsFiles } from '../../server/cluster/transport.js';
import { harness, hello, message, waitFor } from '../../tests/cluster/harness.js';
const lab = JSON.parse(readFileSync('.cluster-local/observability/lab.json')), out = '.cluster-local/observability';
const names = ['rh-gateway', 'rh-game-01', 'rh-game-02', 'rh-game-03', 'rh-coordinator'];
const kafka = identity => ({ brokers: [lab.broker], tlsDir: lab.keys, identity });
const agents = [], telemetry = {}, sockets = [], results = { scope: 'Isolated local laboratory; no production traffic; no synthetic metrics presented as AWS', startedAt: new Date().toISOString() };
let h, panel, browser, probe, promStarted = false, kafkaStopped = false;
const docker = args => execFileSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
const delay = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(250); } throw new Error('Timed out'); };
try {
 for (const [i, id] of names.entries()) {
  const socketPath = `/tmp/rhobs-${process.pid}-${i}.sock`;
  agents.push(await createAgent({ id, tlsDir: lab.keys, kafka: kafka(id), host: '0.0.0.0', port: 19400 + i, socketPath, sample: async metrics => { metrics.set('rh_lab_process_memory_bytes', process.memoryUsage().rss); } }));
  telemetry[id] = new Telemetry(id, { socketPath });
 }
 h = await harness({ telemetry });
 for (const id of names) telemetry[id].start(() => {
  if (id === 'rh-gateway') h.gateway.sample();
  const worker = h.workers.find(w => w.id === id);
  if (worker) { const s = worker.app.status(); for (const k of ['rooms', 'players', 'stepMaxMs', 'eventLoopP99Ms']) telemetry[id].metrics.set('rh_game_' + k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), s[k]); telemetry[id].metrics.set('rh_game_capacity', 2); }
 });
 const jobs = names.map((id, i) => ({ job_name: id, scheme: 'https', static_configs: [{ targets: [`host.docker.internal:${19400 + i}`] }], tls_config: { ca_file: '/tls/ca.crt', cert_file: '/tls/rh-observability.crt', key_file: '/tls/rh-observability.key', server_name: id } }));
 jobs.push({ job_name: 'panel', static_configs: [{ targets: ['host.docker.internal:19410'] }] });
 writeFileSync(out + '/prometheus.json', JSON.stringify({ global: { scrape_interval: '5s', scrape_timeout: '2s' }, scrape_configs: jobs }));
 const mounts = ['ca.crt', 'rh-observability.crt', 'rh-observability.key'].flatMap(n => ['-v', `${lab.keys}/${n}:/tls/${n}:ro`]);
 docker(['run', '-d', '--name', 'rh-observability-prometheus-lab', '--user', '0', '--memory', '768m', '--cpus', '1', '-p', '127.0.0.1:19090:9090', ...mounts, '-v', `${process.cwd()}/${out}/prometheus.json:/etc/prometheus/prometheus.yml:ro`, 'prom/prometheus@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06', '--config.file=/etc/prometheus/prometheus.yml', '--storage.tsdb.retention.time=1h', '--storage.tsdb.retention.size=128MB']); promStarted = true;
 const secret = 'JBSWY3DPEHPK3PXP', password = 'isolated-test-' + randomUUID();
 panel = await createPanel({ development: true, origin: 'http://127.0.0.1:18084', port: 18084, metricsPort: 19410, prometheus: 'http://127.0.0.1:19090', kafka: kafka('rh-panel-consumer'), nodes: names.map(id => ({ id, role: id, instanceId: 'local-process', version: 'laboratorio' })), users: { test: { ...await passwordHash(password), totpSecret: secret, role: 'admin' } } });
 for (let i = 0; i < 3; i++) {
  const a = await h.connect(); sockets.push(a); a.send(JSON.stringify(hello('create'))); const welcome = await message(a, 'welcome');
  const b = await h.connect(); sockets.push(b); b.send(JSON.stringify({ ...hello('join'), code: welcome.code })); await message(b, 'welcome');
  a.send(JSON.stringify({ type: 'ready', ready: true })); b.send(JSON.stringify({ type: 'ready', ready: true })); const owner = h.workers.find(w => w.id === welcome.serverId);
  await waitFor(() => [...owner.app.manager.find(welcome.code).members.values()].every(m => m.ready)); a.send(JSON.stringify({ type: 'start' })); await message(a, 'snapshot');
 }
 await until(() => panel.store.events(0, true).filter(e => e.type === 'room.created').length === 3);
 results.lifecycleThroughKafka = true;
 await until(async () => { await panel.collect(); const r = await fetch('http://127.0.0.1:19090/api/v1/query?query=sum(rh_game_players)'); const j = await r.json(); return Number(j.data.result[0]?.value[1]) === 6; }); results.realGameMetrics = { rooms: 3, players: 6, workers: 3 };
 await until(async () => { const r = await fetch('http://127.0.0.1:19090/api/v1/query?query=rh_gateway_connections'); const j = await r.json(); return Number(j.data.result[0]?.value[1]) === 6; });
 await delay(12000); await panel.collect();
 // Exporter identity checks include authenticated but unauthorized callers.
 const scrape = identity => new Promise((resolve, reject) => { const req = https.get('https://127.0.0.1:19400/metrics', { ...tlsFiles(lab.keys, identity), timeout: 3000 }, r => { r.resume(); r.on('end', () => resolve(r.statusCode)); }); req.on('error', reject); });
 assert.equal(await scrape('rh-observability'), 200); assert.equal(await scrape('rh-game-01'), 403);
 await assert.rejects(new Promise((resolve, reject) => { const req = https.get('https://127.0.0.1:19400/metrics', { ca: readFileSync(lab.keys + '/ca.crt') }, resolve); req.on('error', reject); })); results.exporterMutualTLS = true;
 probe = producerTransport(kafka('rh-game-01'));
 const e = operationalEvent('rh-game-01', 'connection.reconnected'); await probe.send([e, e], AbortSignal.timeout(10000));
 await until(() => panel.metrics.snapshot().some(r => r.name === 'rh_events_duplicates_total' && r.value > 0));
 await probe.producer.send({ topic: topicFor(e), messages: [{ value: '{invalid' }] });
 await until(() => panel.metrics.snapshot().some(r => r.name === 'rh_events_invalid_total' && r.value > 0));
 await assert.rejects(probe.send([operationalEvent('rh-game-02', 'connection.opened')], AbortSignal.timeout(10000))); results.kafkaACLAndDeduplication = true;
 const unauthorized = kafkaClient(kafka('rh-game-01')).consumer({ groupId: 'unauthorized' });
 try { await unauthorized.connect(); await assert.rejects(unauthorized.subscribe({ topic: 'rh.rh-game-02.lifecycle.v1' })); } finally { await unauthorized.disconnect(); }
 browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto('http://127.0.0.1:18084/ops/'); await page.locator('[name=username]').fill('test'); await page.locator('[name=password]').fill(password); await page.locator('[name=otp]').fill(new TOTP({ secret }).generate()); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.locator('#dashboard').waitFor({ state: 'visible' });
 await page.waitForFunction(() => document.querySelector('#summary').textContent.includes('6'));
 const overview = await page.evaluate(async () => (await fetch('/ops/api/overview')).json()); assert.equal(overview.kafka.up, true); assert(overview.metrics.kafka_lag.length > 0); assert.equal(Number(overview.metrics.connections[0].value[1]), 6); writeFileSync(out + '/overview.json', JSON.stringify(overview, null, 2));
 mkdirSync(out + '/screenshots', { recursive: true }); await page.screenshot({ path: out + '/screenshots/overview.png', fullPage: true });
 assert.equal(errors.length, 0); results.browserAuthenticatedRealData = true;
 // Kill only this isolated broker. Established game simulation must continue.
 docker(['pause', lab.container]); kafkaStopped = true;
 const before = sockets[0].messages.filter(m => m.type === 'snapshot').length;
 const rtts = [];
 for (let i = 0; i < 30; i++) { const at = performance.now(); sockets[0].send(JSON.stringify({ type: 'ping', at })); await waitFor(() => sockets[0].messages.some(m => m.type === 'pong' && m.at === at)); rtts.push(performance.now() - at); await delay(400); }
 assert(sockets[0].messages.filter(m => m.type === 'snapshot').length > before); results.gameSurvivesKafkaOutage = { p95Ms: rtts.sort((a,b) => a-b)[28], pollingResolutionMs: 20, workers: h.workers.map(w => ({ id: w.id, ...w.app.status() })) };
 docker(['unpause', lab.container]); kafkaStopped = false;
 await delay(5000); const recovery = operationalEvent('rh-game-01', 'connection.reconnected');
 await until(async () => { try { await probe.send([recovery], AbortSignal.timeout(5000)); return true; } catch { return false; } }, 45000);
 await until(() => panel.store.events(0, true).some(e => e.eventId === recovery.eventId), 45000); results.kafkaRecovery = true;
 results.containers = docker(['stats', '--no-stream', '--format', '{{json .}}', lab.container, 'rh-observability-prometheus-lab']).toString().trim().split('\n').map(JSON.parse);
 results.finishedAt = new Date().toISOString(); writeFileSync(out + '/verification.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally {
 await browser?.close(); await probe?.close(); await panel?.close(); for (const t of Object.values(telemetry)) t.close(); await h?.close(); for (const a of agents) await a.close(); if (promStarted) docker(['rm', '-f', 'rh-observability-prometheus-lab']); if (kafkaStopped) docker(['unpause', lab.container]);
}
