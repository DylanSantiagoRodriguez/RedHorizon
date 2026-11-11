import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager, RoomError } from './RoomManager.js';
import { PROTOCOL_VERSION, GAME_VERSION, ERRORS, validateMessage } from '../src/network/protocol.js';

export function createServer({ buildId = GAME_VERSION, host = '127.0.0.1', port = 8787, origins = ['http://127.0.0.1:5173', 'http://localhost:5173'], tickHz = 60, snapshotHz = 20, maxConnections = 256, perIp = 12, maxRooms = 64, maxBuffered = 1024 * 1024, trustProxy = false, healthPerPlayer = .65, upgradeMs = 15000 } = {}) {
  if (host !== '127.0.0.1' || tickHz < 10 || tickHz > 120 || snapshotHz < 1 || snapshotHz > tickHz || !origins.length) throw new Error('Configuración de servidor inválida');
  let closing = false; const clients = new Map(), limits = new Map();
  const send = (socket, message) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > maxBuffered) { socket.close(1008, 'Cliente lento'); socket.terminate(); return; }
    socket.send(JSON.stringify(message));
  };
  const manager = new RoomManager({ tickHz, maxRooms, send, healthPerPlayer, upgradeMs });
  const server = http.createServer((req, res) => { if (req.url !== '/health') { res.writeHead(404).end(); return; } res.writeHead(closing ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ok: !closing, protocol: PROTOCOL_VERSION, gameVersion: GAME_VERSION, buildId, rooms: manager.rooms.size })); });
  server.maxConnections = maxConnections + 16; server.headersTimeout = 10000; server.requestTimeout = 10000; server.keepAliveTimeout = 5000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const budget = (ip, type, max) => { const key = `${ip}:${type}`, now = Date.now(); let b = limits.get(key); if (!b || now - b.start > 60000) { b = { start: now, count: 0 }; limits.set(key, b); } return ++b.count <= max; };
  server.on('upgrade', (req, socket, head) => {
    const ip = trustProxy && req.socket.remoteAddress === '127.0.0.1' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress;
    if (closing || req.url !== '/ws' || !origins.includes(req.headers.origin) || clients.size >= maxConnections || [...clients.values()].filter(c => c.ip === ip).length >= perIp || !budget(ip, 'connect', 60) || limits.size > 10000) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, ip));
  });
  wss.on('connection', (socket, ip) => {
    const c = { ip, alive: true, count: 0, since: Date.now(), joinedAt: Date.now() }; clients.set(socket, c);
    socket.on('error', () => {}); socket.on('pong', () => { c.alive = true; });
    socket.on('message', (data, binary) => {
      try {
        const now = Date.now(); if (now - c.since >= 1000) { c.since = now; c.count = 0; }
        if (++c.count > 150) { send(socket, { type: 'error', code: 'LIMIT', message: ERRORS.LIMIT }); socket.close(1008, 'Frecuencia'); return; }
        if (binary) throw new RoomError('INVALID');
        let m; try { m = JSON.parse(data.toString()); } catch { throw new RoomError('INVALID'); }
        if (!validateMessage(m)) throw new RoomError('INVALID');
        if (m.type === 'ping') { send(socket, { type: 'pong', at: m.at, serverTime: now }); return; }
        if (['create', 'join', 'reconnect'].includes(m.type)) {
          if (c.member) throw new RoomError('INVALID');
          if (m.version !== PROTOCOL_VERSION || m.gameVersion !== GAME_VERSION) throw new RoomError('VERSION');
          if (!budget(ip, 'access', 40) || m.type === 'create' && !budget(ip, 'create', 8)) throw new RoomError('LIMIT');
          const identity = m.type === 'create' ? manager.create(socket, m.nickname) : m.type === 'join' ? manager.join(m.code, socket, m.nickname) : manager.reconnect(m.code, m.token, socket);
          Object.assign(c, identity); return;
        }
        if (!c.member || c.member.socket !== socket) throw new RoomError('PERMISSION');
        const { room, member } = c;
        if (m.type === 'ready') manager.ready(room, member, m.ready);
        if (m.type === 'start') manager.start(room, member);
        if (m.type === 'input') manager.input(room, member, m);
        if (m.type === 'upgrade' && !room.run?.chooseFor(member.id, m.option, m.round)) throw new RoomError('INVALID');
        if (m.type === 'leave') { manager.disconnect(room, member, true); c.member = null; socket.close(1000, 'Salida'); }
      } catch (error) {
        send(socket, { type: 'error', code: error.code || 'INVALID', message: ERRORS[error.code] || ERRORS.INVALID });
        if (!(error instanceof RoomError)) console.error('Error interno de mensaje', error.name);
      }
    });
    socket.on('close', () => { clients.delete(socket); if (c.member?.socket === socket) manager.disconnect(c.room, c.member); });
  });
  // Wall time drives a fixed-step accumulator. Message volume never advances time.
  let last = performance.now(), accumulator = 0, snapshotAccumulator = 0;
  const timer = setInterval(() => {
    const now = performance.now(); accumulator += Math.min(.25, (now - last) / 1000); last = now;
    let steps = 0;
    while (accumulator >= 1 / tickHz && steps++ < 15) { manager.step(1 / tickHz); accumulator -= 1 / tickHz; snapshotAccumulator += 1 / tickHz; }
    if (snapshotAccumulator >= 1 / snapshotHz) { snapshotAccumulator %= 1 / snapshotHz; manager.snapshots(); }
  }, 1000 / tickHz / 2);
  const heartbeat = setInterval(() => {
    for (const [socket, c] of clients) { if (!c.alive || !c.member && Date.now() - c.joinedAt > 15000) { socket.terminate(); continue; } c.alive = false; socket.ping(); }
    for (const [key, b] of limits) if (Date.now() - b.start > 60000) limits.delete(key);
  }, 10000);
  return {
    server, manager, clients,
    listen: () => new Promise((resolve, reject) => {
      const fail = error => { server.off('error', fail); reject(error); };
      server.once('error', fail);
      server.listen(port, host, () => { server.off('error', fail); resolve(server.address()); });
    }),
    close: async () => {
      if (closing) return; closing = true; clearInterval(timer); clearInterval(heartbeat);
      for (const socket of clients.keys()) send(socket, { type: 'shutdown', message: ERRORS.SHUTDOWN });
      manager.close();
      await new Promise(resolve => { const timeout = setTimeout(() => { for (const s of clients.keys()) s.terminate(); }, 250); wss.close(() => { clearTimeout(timeout); resolve(); }); });
      await new Promise(resolve => server.close(resolve)); clients.clear(); limits.clear();
    },
  };
}
