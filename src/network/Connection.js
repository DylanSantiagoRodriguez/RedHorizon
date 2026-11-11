import { PROTOCOL_VERSION, GAME_VERSION, ERRORS } from './protocol.js';
export class Connection {
  constructor(receive, status) { this.receive = receive; this.status = status; this.attempt = 0; this.closed = false; this.identity = null; }
  static saved() { try { return JSON.parse(sessionStorage.getItem('rh-online')); } catch { return null; } }
  save(identity) { this.identity = identity; try { if (identity) sessionStorage.setItem('rh-online', JSON.stringify(identity)); else sessionStorage.removeItem('rh-online'); } catch { /* Private storage may be unavailable. In-memory reconnection still works. */ } }
  connect(request) {
    clearTimeout(this.retry); this.request = request;
    if (request.type === 'reconnect') this.save({ code: request.code, token: request.token });
    else { this.save(null); this.lostAt = null; }
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); this.socket = socket;
    this.status('Conectando…');
    socket.onopen = () => {
      this.send({ ...request, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION });
      this.lastMessage = this.lastHeartbeat = performance.now(); this.heartbeatGraceUntil = 0;
      this.heartbeat = setInterval(() => {
        const now = performance.now();
        // A stalled render/event loop also delays delivery of queued messages.
        // Probe the link after a stall before judging it dead. Server-side input
        // expiry, vulnerability and the 30-second identity deadline still apply.
        if (now - this.lastHeartbeat > 10000) this.heartbeatGraceUntil = now + 15000;
        this.lastHeartbeat = now;
        if (now - this.lastMessage > 15000 && now >= this.heartbeatGraceUntil) socket.close();
        else this.send({ type: 'ping', at: now });
      }, 5000);
    };
    socket.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; } this.lastMessage = performance.now();
      if (m.type === 'welcome' && (m.version !== PROTOCOL_VERSION || m.gameVersion !== GAME_VERSION)) { this.closed = true; this.save(null); this.status(ERRORS.VERSION); socket.close(); return; }
      if (m.type === 'welcome') { this.save({ code: m.code, token: m.token }); this.attempt = 0; this.lostAt = null; this.status('Conectado'); }
      if (m.type === 'shutdown') { this.closed = true; this.save(null); this.status(m.message); }
      if (m.type === 'error' && ['TOKEN', 'NOT_FOUND', 'VERSION', 'ACTIVE'].includes(m.code)) { this.closed = true; this.save(null); }
      this.receive(m);
    };
    socket.onerror = () => this.status(this.identity ? ERRORS.OFFLINE : ERRORS.UNAVAILABLE);
    socket.onclose = () => {
      clearInterval(this.heartbeat);
      if (this.socket === socket) this.socket = null;
      if (this.closed) return;
      if (!this.identity) { this.status(ERRORS.UNAVAILABLE); return; }
      this.status(ERRORS.OFFLINE); this.lostAt ??= performance.now();
      if (performance.now() - this.lostAt >= 30000) { this.status('Terminó el plazo de reconexión de 30 segundos. Vuelve al menú.'); this.save(null); return; }
      this.retry = setTimeout(() => this.connect({ type: 'reconnect', ...this.identity }), Math.min(4000, 300 * 2 ** this.attempt++) + Math.random() * 200);
    };
  }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) { this.socket.send(JSON.stringify(message)); return true; } return false; }
  dispose() { this.closed = true; clearTimeout(this.retry); clearInterval(this.heartbeat); this.send({ type: 'leave' }); if (this.socket) { this.socket.onclose = null; this.socket.onmessage = null; this.socket.onerror = null; this.socket.onopen = null; this.socket.close(); } this.save(null); }
}
