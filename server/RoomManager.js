import { randomBytes, randomInt } from 'node:crypto';
import { WorldModel } from '../src/world/WorldModel.js';
import { CoopRun } from '../src/core/CoopRun.js';
import { CODE_ALPHABET, normalizeCode, inputAdapter, PROTOCOL_VERSION, GAME_VERSION } from '../src/network/protocol.js';
import { snapshot } from '../src/network/snapshot.js';
export class RoomError extends Error { constructor(code) { super(code); this.code = code; } }
export class RoomManager {
  constructor({ now = Date.now, tickHz = 60, reconnectMs = 30000, maxRooms = 64, lobbyMs = 900000, matchMs = 7200000, healthPerPlayer = .65, upgradeMs = 15000, send = (s, m) => s.send(JSON.stringify(m)) } = {}) {
    Object.assign(this, { now, tickHz, reconnectMs, maxRooms, lobbyMs, matchMs, healthPerPlayer, upgradeMs, send }); this.rooms = new Map();
  }
  code() { let code; do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code)); return code; }
  create(socket, nickname) {
    if (this.rooms.size >= this.maxRooms) throw new RoomError('LIMIT');
    const room = { code: this.code(), members: new Map(), hostId: null, createdAt: this.now(), tick: 0, events: [], eventId: 0 };
    this.rooms.set(room.code, room); return this.add(room, socket, nickname);
  }
  find(code) { code = normalizeCode(code); if (code.length !== 6 || [...code].some(c => !CODE_ALPHABET.includes(c))) throw new RoomError('INVALID_CODE'); const r = this.rooms.get(code); if (!r) throw new RoomError('NOT_FOUND'); return r; }
  join(code, socket, nickname) { const room = this.find(code); if (room.run) throw new RoomError('STARTED'); if (room.members.size >= 4) throw new RoomError('FULL'); return this.add(room, socket, nickname); }
  add(room, socket, nickname = '') {
    const id = randomBytes(12).toString('hex'), token = randomBytes(32).toString('hex');
    const member = { id, token, nickname: nickname.trim().replace(/[\p{C}]/gu, '').slice(0, 20) || `Explorador ${room.members.size + 1}`, ready: false, socket, ack: 0, received: 0, queue: [], lastInputAt: 0, disconnectedAt: null };
    room.members.set(id, member); room.hostId ||= id; this.welcome(room, member); this.broadcastLobby(room); return { room, member };
  }
  welcome(room, m) { this.send(m.socket, { type: 'welcome', tickHz: this.tickHz, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION, code: room.code, playerId: m.id, token: m.token, seq: m.received, started: !!room.run }); if (room.run) this.send(m.socket, snapshot(room, this.now())); }
  reconnect(code, token, socket) {
    const room = this.find(code), member = [...room.members.values()].find(m => m.token === token);
    if (!member || member.expired || member.disconnectedAt !== null && this.now() - member.disconnectedAt >= this.reconnectMs) throw new RoomError('TOKEN');
    if (member.socket) throw new RoomError('ACTIVE');
    member.socket = socket; member.disconnectedAt = null; member.queue = []; member.last = null;
    room.hostId ||= member.id; this.welcome(room, member); this.broadcastLobby(room); return { room, member };
  }
  lobby(room) { return { type: 'lobby', code: room.code, hostId: room.hostId, started: !!room.run, players: [...room.members.values()].map(m => ({ id: m.id, nickname: m.nickname, ready: m.ready, connected: !!m.socket, expired: !!m.expired })) }; }
  broadcastLobby(room) { this.broadcast(room, this.lobby(room)); }
  broadcast(room, message) { for (const m of room.members.values()) if (m.socket) this.send(m.socket, message); }
  ready(room, member, value) { if (room.run) throw new RoomError('STARTED'); member.ready = value; this.broadcastLobby(room); }
  start(room, member) {
    if (room.run) throw new RoomError('STARTED');
    if (member.id !== room.hostId || room.members.size < 2 || [...room.members.values()].some(m => !m.socket || !m.ready)) throw new RoomError('PERMISSION');
    room.startedAt = this.now();
    room.run = new CoopRun(new WorldModel(room.code), room.code, [...room.members.keys()], (name, data) => {
      room.events.push({ id: ++room.eventId, name, data }); if (room.events.length > 128) room.events.shift();
    }, { healthPerPlayer: this.healthPerPlayer, upgradeMs: this.upgradeMs });
    room.run.now = this.now(); this.broadcastLobby(room); this.broadcast(room, snapshot(room, this.now()));
  }
  input(room, member, message) {
    if (!room.run || member.expired) return;
    if (message.seq <= member.received) return; // Retransmitted edges cannot run twice.
    if (message.seq > member.received + 180 || member.queue.length >= 90) throw new RoomError('LIMIT');
    member.received = message.seq; member.lastInputAt = this.now(); member.queue.push(message);
  }
  disconnect(room, member, permanent = false) {
    if (!room.members.has(member.id)) return;
    member.socket = null; member.queue = []; member.last = null; member.disconnectedAt = this.now();
    if (room.run) room.run.members.get(member.id).autoFire = false;
    if (permanent) { member.expired = true; member.token = ''; if (room.run) room.run.abandon(member.id); else room.members.delete(member.id); }
    if (room.hostId === member.id) room.hostId = [...room.members.values()].find(m => m.socket)?.id || null;
    this.broadcastLobby(room);
    if (!room.members.size) this.rooms.delete(room.code);
  }
  step(dt) {
    const now = this.now();
    for (const room of this.rooms.values()) {
      for (const m of room.members.values()) if (!m.socket && !m.expired && now - m.disconnectedAt >= this.reconnectMs) this.disconnect(room, m, true);
      if (![...room.members.values()].some(m => !m.expired) || now - (room.startedAt || room.createdAt) > (room.run ? this.matchMs : this.lobbyMs) || room.endedAt && now - room.endedAt > 60000) {
        for (const m of room.members.values()) m.socket?.close(1000, 'Sala caducada'); this.rooms.delete(room.code); continue;
      }
      if (!room.run) continue;
      const inputs = new Map();
      for (const m of room.members.values()) {
        const fresh = !!m.socket && now - m.lastInputAt < 250;
        const next = fresh ? m.queue.shift() : null;
        if (!fresh) { m.queue = []; m.last = null; room.run.members.get(m.id).autoFire = false; }
        if (next) { m.ack = next.seq; m.last = { ...next, actions: [] }; }
        const message = next || m.last;
        if (message && fresh) { if (!message.enabled) room.run.members.get(m.id).autoFire = false; inputs.set(m.id, { input: inputAdapter(message), yaw: message.yaw, aim: message.aim }); }
      }
      room.run.update(dt, inputs, now); room.tick++;
      if (['victory', 'defeat'].includes(room.run.status)) room.endedAt ||= now;
    }
  }
  snapshots() { const now = this.now(); for (const room of this.rooms.values()) if (room.run) this.broadcast(room, snapshot(room, now)); }
  close() { for (const room of this.rooms.values()) for (const m of room.members.values()) m.socket?.close(1012, 'Reinicio del servidor'); this.rooms.clear(); }
}
