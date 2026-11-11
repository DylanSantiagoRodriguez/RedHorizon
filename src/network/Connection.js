import { PROTOCOL_VERSION, GAME_VERSION, ERRORS } from './protocol.js';
export class Connection {
  constructor(receive, status) { this.receive = receive; this.status = status; this.attempt = 0; this.closed = false; this.identity = null; }
  static saved() { try { return JSON.parse(sessionStorage.getItem('rh-online')); } catch { return null; } }
  save(identity) { this.identity = identity; try { if (identity) sessionStorage.setItem('rh-online', JSON.stringify(identity)); else sessionStorage.removeItem('rh-online'); } catch { /* Private storage may be unavailable. In-memory reconnection still works. */ } }
  connect(request) {
    clearTimeout(this.retry); this.request = request;
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); this.socket = socket;
    this.status('Conectando…');
    socket.onopen = () => { this.send({ ...request, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION }); this.lastMessage = performance.now(); this.heartbeat = setInterval(() => { if (performance.now() - this.lastMessage > 15000) socket.close(); else this.send({ type: 'ping', at: performance.now() }); }, 5000); };
    socket.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; } this.lastMessage = performance.now();
      if (m.type === 'welcome' && (m.version !== PROTOCOL_VERSION || m.gameVersion !== GAME_VERSION)) { this.closed = true; this.save(null); this.status(ERRORS.VERSION); socket.close(); return; }
      if (m.type === 'welcome') { this.save({ code: m.code, token: m.token }); this.attempt = 0; this.lostAt = null; this.status('Conectado'); }
      if (m.type === 'shutdown') { this.closed = true; this.save(null); this.status(m.message); }
      if (m.type === 'error' && ['TOKEN', 'NOT_FOUND', 'VERSION', 'ACTIVE'].includes(m.code)) { this.closed = true; this.save(null); }
      this.receive(m);
    };
    socket.onerror = () => this.status(ERRORS.OFFLINE);
    socket.onclose = () => {
      clearInterval(this.heartbeat); if (this.closed) return;
      this.status(ERRORS.OFFLINE); this.lostAt ||= performance.now();
      if (!this.identity || performance.now() - this.lostAt >= 30000) { this.status('Sin conexión. La sala o el plazo de reconexión ha terminado. Vuelve al menú.'); this.save(null); return; }
      this.retry = setTimeout(() => this.connect({ type: 'reconnect', ...this.identity }), Math.min(4000, 300 * 2 ** this.attempt++) + Math.random() * 200);
    };
  }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) { this.socket.send(JSON.stringify(message)); return true; } return false; }
  dispose() { this.closed = true; clearTimeout(this.retry); clearInterval(this.heartbeat); this.send({ type: 'leave' }); if (this.socket) { this.socket.onclose = null; this.socket.onmessage = null; this.socket.onerror = null; this.socket.onopen = null; this.socket.close(); } this.save(null); }
}
