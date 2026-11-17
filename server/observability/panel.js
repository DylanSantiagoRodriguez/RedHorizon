import { Limiter } from '../cluster/limiter.js';
import { awsMetrics } from './aws-metrics.js';
import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { Auth } from './auth.js';
import { EventStore } from './store.js';
import { kafkaClient, TOPICS } from './kafka.js';
import { Metrics, prometheus } from './metrics.js';
const queries = {
  nginx_rejected: 'rh_nginx_rate_rejected_total', nginx_responses: 'rate(rh_nginx_responses_total[1m])', nginx_log_dropped: 'rh_nginx_log_dropped_bytes_total',
  kafka_produced_bytes_s: 'rate(rh_kafka_produced_bytes_total[1m])', kafka_consumed_bytes_s: 'rate(rh_kafka_consumed_bytes_total[1m])',
  version: 'rh_application_build_info or rh_service_build_info',
  coordinator_request_bytes_s: 'rate(rh_coordinator_request_bytes_total[1m])',
  coordinator_response_bytes_s: 'rate(rh_coordinator_response_bytes_total[1m])',
  host_cpu: '1 - rate(rh_host_cpu_idle_ticks[1m]) / rate(rh_host_cpu_total_ticks[1m])',
  memory_used_bytes: 'rh_host_memory_total_bytes-rh_host_memory_available_bytes',
  memory_total_bytes: 'rh_host_memory_total_bytes', disk_available_bytes: 'rh_host_disk_available_bytes',
  network_received_bytes_s: 'rate(rh_host_network_received_bytes_total[1m])', network_sent_bytes_s: 'rate(rh_host_network_sent_bytes_total[1m])',
  logical_received_bytes_s: 'rate(rh_gateway_logical_received_bytes_total[1m])', logical_sent_bytes_s: 'rate(rh_gateway_logical_sent_bytes_total[1m])',
  transport_sent_bytes_s: 'clamp_min(deriv((rh_gateway_transport_sent_bytes_total + rh_gateway_transport_open_sent_bytes)[1m:5s]),0)',
  rooms: 'rh_game_rooms', players: 'rh_game_players', capacity: 'rh_game_capacity', draining: 'rh_game_draining',
  event_loop_p99_ms: 'rh_game_event_loop_p99_ms', simulation_max_ms: 'rh_game_step_max_ms',
  connections: 'rh_gateway_connections', worker_connections: 'rh_gateway_worker_connections',
  messages_s: 'rate(rh_gateway_messages_received_total[1m])', rejected_s: 'rate(rh_game_rejected[1m])',
  rtt_p50_ms: 'histogram_quantile(0.50, sum by (le,node) (rate(rh_websocket_transport_rtt_ms_bucket[5m])))',
  rtt_p95_ms: 'histogram_quantile(0.95, sum by (le,node) (rate(rh_websocket_transport_rtt_ms_bucket[5m])))',
  rtt_p99_ms: 'histogram_quantile(0.99, sum by (le,node) (rate(rh_websocket_transport_rtt_ms_bucket[5m])))',
  service_up: 'rh_service_up', restarts: 'rh_service_restarts_total', exporter_up: 'up',
  freshness: 'rh_host_sample_timestamp_seconds', app_freshness: 'rh_application_report_timestamp_seconds',
  certificate_expires: 'rh_certificate_expires_seconds', certificates: 'rh_certificate_named_expires_seconds', dropped: 'rh_events_dropped_total', application_dropped: 'rh_application_telemetry_dropped_total', queue: 'rh_events_pending',
  tls_failures: 'rh_tls_failures_total', exporter_tls_failures: 'rh_exporter_tls_failures_total', handshake_rejected: 'rh_handshake_rejected_total',
  kafka_lag: 'rh_kafka_consumer_lag', kafka_up: 'rh_kafka_consumer_up',
};
export async function createPanel(config) {
  if (!config.development && (!config.tls || !config.origin?.startsWith('https://'))) throw new Error('Production requires TLS and HTTPS origin');
  const store = new EventStore(config.dbPath), auth = new Auth(config.users, store), metrics = new Metrics();
  let consumer, admin, poll, consuming = false, brokerUp = false, kafkaCheckedAt = 0, lastErrorAt = 0;
  const requestLimits = new Limiter(256), offsets = new Map(), cloud = config.awsMetrics ? awsMetrics(config.nodes) : null;
  const files = new Map([['/ops/', ['index.html', 'text/html']], ['/ops/app.js', ['app.js', 'text/javascript']], ['/ops/style.css', ['style.css', 'text/css']]]);
  const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const token = req => /(?:^|;\s*)__Host-rhops=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const originOK = req => req.headers.origin === config.origin && req.headers['content-type']?.split(';')[0] === 'application/json';
  let snapshot = null, collectionAt = 0, collectionBusy = false;
  const query = async expression => {
    const url = new URL('/api/v1/query', config.prometheus); url.searchParams.set('query', expression);
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (!res.ok) throw new Error('Prometheus unavailable');
    const data = await res.json(); if (data.status !== 'success') throw new Error('Query failed'); return data.data.result;
  };
  const collect = async () => {
    if (collectionBusy) return; collectionBusy = true;
    try { const rows = {}; for (let i = 0, entries = Object.entries(queries); i < entries.length; i += 6) await Promise.all(entries.slice(i, i + 6).map(async ([key, q]) => { rows[key] = await query(q); })); snapshot = rows; collectionAt = Date.now(); }
    catch { lastErrorAt = Date.now(); } finally { collectionBusy = false; }
  };
  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (!config.development && (!req.socket.authorized || req.socket.getPeerCertificate().subject.CN !== 'rh-gateway')) return send(res, 403, { error: 'Forbidden' });
    try {
      const url = new URL(req.url, config.origin), path = url.pathname;
      if (files.has(path) && req.method === 'GET') { const [name, type] = files.get(path); res.writeHead(200, { 'Content-Type': type }); return res.end(await readFile(new URL('../../web/observability/' + name, import.meta.url))); }
      const session = auth.get(token(req));
      if (path === '/ops/api/login' && req.method === 'POST') {
        if (!originOK(req)) return send(res, 403, { error: 'Forbidden' });
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) { res.writeHead(413).end(); req.destroy(); return; } }
        let ip = config.development ? req.socket.remoteAddress : req.headers['x-real-ip']; if (!isIP(ip || '')) ip = 'unknown';
        const b = JSON.parse(raw), s = await auth.login(b.username, b.password, b.otp, ip);
        if (!s) { metrics.inc('rh_panel_login_rejected_total'); return send(res, 401, { error: 'Credenciales o código inválidos; espera antes de reintentar.' }); }
        res.setHeader('Set-Cookie', `__Host-rhops=${s}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`); return send(res, 200, { ok: true });
      }
      if (!session) return send(res, 401, { error: 'Authentication required' });
      if (path === '/ops/api/logout' && req.method === 'POST') { if (!originOK(req)) return send(res, 403, { error: 'Forbidden' }); auth.logout(token(req)); res.setHeader('Set-Cookie', '__Host-rhops=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); return send(res, 200, { ok: true }); }
      if (!requestLimits.take(session.username, 40, 4)) return send(res, 429, { error: 'Too many requests' });
      if (req.method !== 'GET') return send(res, 405, { error: 'Read only' });
      if (path === '/ops/api/session') return send(res, 200, { username: session.username, role: session.role });
      if (path === '/ops/api/overview') return send(res, 200, { nodes: config.nodes.map(n => ({ ...n, version: snapshot?.version?.find(r => r.metric.node === n.id)?.metric.revision || store.version(n.id) || n.version || null })), aws: cloud?.state || null, metrics: snapshot, collectedAt: collectionAt, stale: Date.now() - collectionAt > 15000, lastErrorAt, kafka: { up: consuming && brokerUp, checkedAt: kafkaCheckedAt, offsets: [...offsets] }, mode: config.development ? 'laboratorio local' : 'AWS' });
      if (path === '/ops/api/events') { const seconds = Math.min(604800, Math.max(60, Number(url.searchParams.get('seconds')) || 3600)); return send(res, 200, store.events(Date.now() - seconds * 1000, session.role === 'admin')); }
      if (path === '/ops/api/security') { if (session.role !== 'admin') return send(res, 403, { error: 'Administrator required' }); return send(res, 200, { events: store.events(Date.now() - 3600000, true).filter(e => e.type === 'security.rejected'), telemetry: metrics.snapshot() }); }
      if (path === '/ops/api/history') {
        const name = url.searchParams.get('metric'), seconds = Number(url.searchParams.get('seconds'));
        if (!Object.hasOwn(queries, name) || ![300, 3600, 86400].includes(seconds)) return send(res, 400, { error: 'Invalid selection' });
        const endpoint = new URL('/api/v1/query_range', config.prometheus); const end = Math.floor(Date.now() / 1000);
        for (const [k, v] of Object.entries({ query: queries[name], start: end - seconds, end, step: Math.max(5, Math.ceil(seconds / 300)) })) endpoint.searchParams.set(k, v);
        const result = await fetch(endpoint, { signal: AbortSignal.timeout(3000) }); if (!result.ok) throw new Error('Query unavailable'); return send(res, 200, await result.json());
      }
      return send(res, 404, { error: 'Not found' });
    } catch { if (!res.headersSent) send(res, 503, { error: 'Datos temporalmente no disponibles' }); else res.end(); }
  };
  const server = config.development ? http.createServer(handler) : https.createServer({ ...config.tls, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, handler);
  server.on('tlsClientError', () => metrics.inc('rh_panel_tls_failures_total'));
  server.maxConnections = 32; server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise(r => server.listen(config.port ?? 8444, config.development ? '127.0.0.1' : config.host, r));
  const exposition = http.createServer((req, res) => { if (req.url !== '/metrics') return res.writeHead(404).end(); res.setHeader('Content-Type', 'text/plain; version=0.0.4'); res.end(prometheus(metrics.snapshot(), 'rh-observability')); });
  await new Promise(r => exposition.listen(config.metricsPort ?? 9401, '127.0.0.1', r));
  if (config.kafka) {
    const client = kafkaClient(config.kafka); consumer = client.consumer({ groupId: 'rh-panel-v1', maxBytes: 65536, maxBytesPerPartition: 65536, maxWaitTimeInMs: 500, heartbeatInterval: 1000, sessionTimeout: 10000, retry: { retries: 2, restartOnFailure: async () => false } }); admin = client.admin();
    let starting = false;
    const start = async () => { if (starting || consuming) return; starting = true; try { await consumer.connect(); await consumer.subscribe({ topics: TOPICS, fromBeginning: true }); await consumer.run({ eachMessage: async ({ topic, partition, message }) => { try { metrics.inc('rh_kafka_consumed_bytes_total', message.value?.length || 0); if (message.value.length > 16384) throw new Error('Oversized'); const changed = store.add(JSON.parse(message.value), topic); metrics.inc(changed ? 'rh_events_consumed_total' : 'rh_events_duplicates_total'); } catch { metrics.inc('rh_events_invalid_total'); } offsets.set(`${topic}:${partition}`, message.offset); } }); } catch { consuming = false; } finally { starting = false; } };
    consumer.on(consumer.events.CRASH, event => { consuming = false; metrics.set('rh_kafka_consumer_up', 0); metrics.inc('rh_kafka_consumer_errors_total', 1, { reason: event.payload.error.name }); }); consumer.on(consumer.events.DISCONNECT, () => { consuming = false; }); consumer.on(consumer.events.GROUP_JOIN, () => { consuming = true; });
    void start(); let polling = false;
    poll = setInterval(async () => { if (polling) return; polling = true; try { if (!consuming) await start(); await admin.connect(); let lag = 0; const committed = await admin.fetchOffsets({ groupId: 'rh-panel-v1', topics: TOPICS }); const saved = new Map(committed.flatMap(t => t.partitions.map(p => [`${t.topic}:${p.partition}`, Number(p.offset)]))); for (const topic of TOPICS) { const end = await admin.fetchTopicOffsets(topic); for (const part of end) lag += Math.max(0, Number(part.offset) - Math.max(Number(offsets.get(`${topic}:${part.partition}`) ?? -1) + 1, saved.get(`${topic}:${part.partition}`) ?? 0)); } metrics.set('rh_kafka_consumer_lag', lag); brokerUp = true; kafkaCheckedAt = Date.now(); metrics.set('rh_kafka_consumer_up', Number(consuming)); } catch { brokerUp = false; metrics.set('rh_kafka_consumer_up', 0); } finally { polling = false; } }, 10000); poll.unref();
  }
  const sample = setInterval(collect, 5000), prune = setInterval(() => store.prune(), 60000); sample.unref(); prune.unref(); void collect();
  return { server, auth, store, metrics, collect, close: async () => { cloud?.close(); clearInterval(sample); clearInterval(prune); clearInterval(poll); await consumer?.disconnect(); await admin?.disconnect(); await Promise.all([new Promise(r => { server.closeAllConnections(); server.close(r); }), new Promise(r => { exposition.closeAllConnections(); exposition.close(r); })]); store.close(); } };
}
if (process.argv[1]?.endsWith('/panel.js')) {
  const config = JSON.parse(await readFile(process.env.RH_OBSERVABILITY_CONFIG, 'utf8'));
  if (config.development) throw new Error('Development mode only available to local test harness');
  config.users = JSON.parse(await readFile(config.usersFile, 'utf8'));
  config.tls = Object.fromEntries(await Promise.all(['ca', 'cert', 'key'].map(async k => [k, await readFile(config.tls[k])])));
  const panel = await createPanel(config);
  for (const s of ['SIGTERM', 'SIGINT']) process.once(s, async () => { await panel.close(); process.exit(0); });
}
