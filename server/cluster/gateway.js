import http from 'node:http';
import { isIP } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { validateMessage, normalizeCode, PROTOCOL_VERSION, GAME_VERSION, ERRORS } from '../../src/network/protocol.js';
import { Limiter } from './limiter.js';

// Nginx terminates public TLS. This process only accepts loopback connections.
// Only the initial message consults the coordinator; active sockets are independent.
export function createGateway({ coordinator, workers, tls, origins, port = 8788, maxConnections = 256, trustProxy = false, buildId = GAME_VERSION }) {
  for (const [id, url] of Object.entries(workers)) if (!/^rh-game-0[123]$/.test(id) || new URL(url).protocol !== 'wss:') throw new Error('Invalid worker allowlist');
  const limiter = new Limiter(), pairs = new Map(), rejectionReasons = {}; let rejected = 0;
  const server = http.createServer((req, res) => { if (req.url !== '/health') return res.writeHead(404).end(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, buildId, connections: pairs.size, rejected, rejectionReasons })); });
  // Compress public snapshots, with no shared compression history. Small identity
  // messages remain uncompressed; inbound decompressed messages still have a 4 KiB cap.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: {
    threshold: 1024, serverNoContextTakeover: true, clientNoContextTakeover: true,
    concurrencyLimit: 4, zlibDeflateOptions: { level: 1, memLevel: 7 },
  } });
  const fail = (socket, code, reason = code) => { rejected++; rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1; if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', code, message: ERRORS[code] || ERRORS.UNAVAILABLE })); socket.close(1008, code); };
  server.on('upgrade', (req, socket, head) => {
    const ip = trustProxy ? req.headers['x-real-ip'] : req.socket.remoteAddress;
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('server');
    if (!isIP(ip || '') || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || url.pathname !== '/ws' || !origins.includes(req.headers.origin) || route && !Object.hasOwn(workers, route) || pairs.size >= maxConnections || [...pairs.values()].filter(p => p.ip === ip).length >= 12 || !limiter.take(`connect:${ip}`, 20, 1)) { rejected++; socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, { ip, origin: req.headers.origin, route }));
  });
  wss.on('connection', (client, { ip, origin, route }) => {
    const pair = { ip, upstream: null, selecting: false, ready: false }; pairs.set(client, pair);
    const timeout = setTimeout(() => fail(client, 'UNAVAILABLE'), 10000);
    client.on('error', () => {});
    client.on('close', () => { clearTimeout(timeout); pair.upstream?.terminate(); pairs.delete(client); });
    let messages = 0, window = Date.now();
    client.on('message', async (data, binary) => {
      if (Date.now() - window >= 1000) { messages = 0; window = Date.now(); }
      if (++messages > 150 || binary) return fail(client, 'LIMIT', 'message_rate_or_binary');
      if (pair.ready) { if (pair.upstream.bufferedAmount > 65536) return fail(client, 'LIMIT', 'upstream_backpressure'); pair.upstream.send(data, { binary: false }); return; }
      if (pair.selecting) return fail(client, 'INVALID');
      pair.selecting = true;
      try {
        const m = JSON.parse(data.toString());
        if (!validateMessage(m) || !['create', 'join', 'reconnect'].includes(m.type)) return fail(client, 'INVALID');
        if (m.version !== PROTOCOL_VERSION || m.gameVersion !== GAME_VERSION) return fail(client, 'VERSION');
        if (!limiter.take(`${m.type}:${ip}`, m.type === 'create' ? 4 : 12, m.type === 'create' ? 8 / 60 : 40 / 60)) return fail(client, 'LIMIT');
        // A reconnect hint is allowlisted, not authoritative. The owner still validates
        // the 256-bit reconnection token. This also works during coordinator outage.
        const assignment = m.type === 'reconnect' && route ? { worker: route } : await coordinator(m.type === 'create' ? '/reserve' : '/lookup', { code: normalizeCode(m.code) });
        if (client.readyState !== WebSocket.OPEN) return;
        if (!Object.hasOwn(workers, assignment.worker)) return fail(client, 'UNAVAILABLE');
        const headers = { 'x-real-ip': ip };
        if (m.type === 'create') { headers['x-rh-code'] = assignment.code; headers['x-rh-reservation'] = assignment.token; }
        const upstream = pair.upstream = new WebSocket(workers[assignment.worker], { ...tls, rejectUnauthorized: true, origin, headers, handshakeTimeout: 3000, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
        upstream.on('error', () => fail(client, 'UNAVAILABLE'));
        upstream.on('open', () => { if (client.readyState !== WebSocket.OPEN) return upstream.terminate(); pair.ready = true; clearTimeout(timeout); upstream.send(JSON.stringify(m)); });
        upstream.on('message', data => { if (client.readyState !== WebSocket.OPEN) return; if (client.bufferedAmount > 1024 * 1024) return fail(client, 'LIMIT', 'downstream_backpressure'); client.send(data, { binary: false }); });
        upstream.on('close', () => client.close(1012, 'Servidor desconectado'));
      } catch (error) { fail(client, Object.hasOwn(ERRORS, error.code) ? error.code : 'UNAVAILABLE'); }
    });
    // Proxy application traffic and answer transport pings on each leg separately.
    client.alive = true; client.on('pong', () => { client.alive = true; });
  });
  const heartbeat = setInterval(() => { limiter.sweep(); for (const client of pairs.keys()) { if (!client.alive) client.terminate(); else { client.alive = false; client.ping(); } } }, 10000);
  return { server, pairs, listen: () => new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server.address()))), close: async () => { clearInterval(heartbeat); for (const [client, p] of pairs) { p.upstream?.terminate(); client.terminate(); } await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); } };
}
