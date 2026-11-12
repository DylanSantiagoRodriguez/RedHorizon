import { Connection } from './Connection.js';
import { HELD, ACTIONS, inputAdapter } from './protocol.js';
import { Player } from '../entities/Player.js';
import { UPGRADES } from '../data/upgrades.js';

export class OnlineGame {
  constructor(game) {
    this.game = game; this.seq = 0; this.step = 1 / 60; this.accumulator = 0; this.pending = []; this.history = []; this.players = new Map(); this.extraActions = []; this.connectionState = 'Sin conexión';
    this.connection = new Connection(m => this.receive(m), text => { this.connectionState = text; this.connected = text === 'Conectado'; if (!this.connected) { game.input.clear(); this.pending = []; } this.updateTeam(); this.updateLobbyStatus(); });
    this.team = document.createElement('aside'); this.team.className = 'online-team'; this.team.setAttribute('aria-label', 'Equipo'); this.team.hidden = true;
    const hud = game.ui.hud.nodes.hud;
    this.sidebar = document.createElement('div'); this.sidebar.className = 'online-sidebar';
    this.overview = document.createElement('div'); this.overview.className = 'online-overview';
    this.missionPanel = hud.querySelector('.mission'); this.vitalsPanel = hud.querySelector('.vitals');
    this.overview.append(this.team, this.missionPanel); this.sidebar.append(this.overview, this.vitalsPanel); hud.appendChild(this.sidebar);
  }
  open() {
    const ui = this.game.ui; ui.overlay.hidden = false; ui.overlay.className = 'modal-overlay';
    ui.overlay.innerHTML = `<section class="dialog online-dialog"><span class="eyebrow">AURORA / COOPERATIVO ONLINE</span><h2>Multijugador</h2><p>2–4 exploradores. Sin cuentas. Todos comienzan con estadísticas base. No se ganan fragmentos ni blindaje para el modo individual.</p><label>Apodo (opcional)<input id="online-name" maxlength="20" placeholder="Explorador"></label><button id="create-room" class="primary">Crear sala</button><label>Código de sala<input id="room-code" maxlength="32" autocomplete="off" placeholder="ABC234"></label><button id="join-room" class="secondary">Unirse con código</button><p id="online-status" role="status"></p><button id="online-back" class="text-button">Volver al menú</button></section>`;
    const request = type => { if (this.connection.socket) return; this.error = ''; this.connection.connect({ type, nickname: ui.overlay.querySelector('#online-name').value, ...(type === 'join' ? { code: ui.overlay.querySelector('#room-code').value } : {}) }); };
    ui.overlay.querySelector('#create-room').onclick = () => request('create');
    ui.overlay.querySelector('#join-room').onclick = () => request('join');
    ui.overlay.querySelector('#online-back').onclick = () => this.game.menu();
    const saved = Connection.saved(); if (saved) this.connection.connect({ type: 'reconnect', ...saved });
  }
  updateLobbyStatus() { const node = this.game.ui.overlay.querySelector('#online-status'); if (node) node.textContent = this.error || this.connectionState; }
  receive(m) {
    if (m.type === 'welcome') { this.step = 1 / m.tickHz; this.accumulator = 0; this.playerId = m.playerId; this.code = m.code; this.seq = m.seq; this.pending = []; this.history = []; this.fresh = true; this.error = ''; }
    if (m.type === 'lobby') { this.lobby = m; if (!m.started) this.showLobby(); }
    if (m.type === 'error') {
      this.error = m.message; this.updateLobbyStatus(); this.game.ui.hud.toast(m.message);
      if (!this.playerId) { this.connection.dispose(); this.connection = new Connection(n => this.receive(n), text => { this.connectionState = text; this.connected = text === 'Conectado'; this.updateLobbyStatus(); }); }
    }
    if (m.type === 'snapshot') this.snapshot(m);
  }
  showLobby() {
    const overlay = this.game.ui.overlay; overlay.hidden = false; overlay.className = 'modal-overlay';
    overlay.innerHTML = `<section class="dialog online-dialog"><span class="eyebrow">COOPERATIVO ONLINE</span><h2>Equipo de expedición</h2><div class="room-code-panel"><span id="lobby-code-label">Código de sala</span><strong id="lobby-code" aria-labelledby="lobby-code-label"></strong><p>Comparte este código para que tus amigos se unan.</p><button id="copy-code" class="secondary">Copiar código</button></div><ul id="lobby-players"></ul><p>Todos deben estar conectados y listos (2–4). Estadísticas base; sin metaprogresión individual.</p><button id="ready-room" class="primary">Listo</button><button id="start-room" class="secondary">Iniciar expedición</button><p id="online-status" role="status"></p><button id="leave-room" class="text-button">Abandonar sala</button></section>`;
    overlay.querySelector('#lobby-code').textContent = this.code;
    for (const p of this.lobby.players) { const li = document.createElement('li'); li.textContent = `${p.nickname}${p.id === this.lobby.hostId ? ' · Creador' : ''} · ${p.connected ? (p.ready ? 'Listo' : 'Preparándose') : 'Desconectado'}`; overlay.querySelector('#lobby-players').appendChild(li); }
    const me = this.lobby.players.find(p => p.id === this.playerId);
    overlay.querySelector('#ready-room').textContent = me?.ready ? 'Cancelar listo' : 'Listo';
    overlay.querySelector('#ready-room').onclick = () => this.connection.send({ type: 'ready', ready: !me?.ready });
    overlay.querySelector('#start-room').disabled = this.playerId !== this.lobby.hostId || this.lobby.players.length < 2 || this.lobby.players.some(p => !p.connected || !p.ready);
    overlay.querySelector('#start-room').onclick = () => this.connection.send({ type: 'start' });
    overlay.querySelector('#copy-code').onclick = async () => { try { await navigator.clipboard.writeText(this.code); this.error = 'Código copiado'; } catch { this.error = `Comparte este código: ${this.code}`; } this.updateLobbyStatus(); };
    overlay.querySelector('#leave-room').onclick = () => this.game.menu(); this.updateLobbyStatus();
  }
  snapshot(s) {
    const g = this.game;
    if (!this.started) { g.createRun(s.seed, false); this.started = true; g.camera.yaw = 0; g.camera.ready = false; g.audio.unlock().catch(() => {}); }
    if (this.latest && s.tick < this.latest.tick) return;
    this.latest = s; this.receivedAt = performance.now(); this.history.push({ snapshot: s, at: this.receivedAt }); if (this.history.length > 8) this.history.shift();
    const r = g.run;
    Object.assign(r, { status: s.status, time: s.time, kills: s.kills, salvage: 0, mission: { ...s.mission }, gems: s.gems, plushCount: s.plushCount || 0, plushPower: !!s.plushPower });
    Object.assign(r.experience, { level: s.experience.level, xp: s.experience.xp, pending: s.experience.pending });
    for (const p of s.players) {
      let member = this.players.get(p.id); if (!member) { member = { player: new Player() }; this.players.set(p.id, member); }
      Object.assign(member.player, p, { stats: { ...p.stats } }); Object.assign(member, { weapon: p.weapon, ability: p.ability, nickname: p.nickname, connected: p.connected, upgrades: { stacks: p.upgrades.stacks, offers: p.upgrades.offers.map(id => UPGRADES.find(u => u.id === id)) } });
    }
    const local = this.players.get(this.playerId), authoritative = s.players.find(p => p.id === this.playerId); if (!local) return;
    r.player = local.player; r.weapon = local.weapon; Object.assign(r.ability, local.ability); r.upgrades = local.upgrades; r.autoFire = authoritative.autoFire;
    for (const a of r.altars) Object.assign(a, s.altars.find(o => o.id === a.id));
    for (const o of [r.launchBeacon, ...g.world.beacons, ...g.world.rewards, ...(g.world.plushies || [])]) Object.assign(o, s.interactables.find(i => i.id === o.id));
    r.interaction = [r.launchBeacon, ...r.altars, ...g.world.beacons, ...g.world.rewards, ...(g.world.plushies || [])].find(o => o.id === authoritative.interactionId) || null;
    const enemies = new Map(r.enemies.map(e => [e.id, e]));
    for (const e of r.enemies) if (!s.enemies.some(n => n.id === e.id)) e.dead = true;
    r.enemies = s.enemies.map(data => { const e = enemies.get(data.id) || {}; for (const key of Object.keys(e)) if (!(key in data)) delete e[key]; return Object.assign(e, data); });
    r.combat.pool.items = s.projectiles; Object.assign(r.boss, { guardians: s.boss.guardians, zones: s.boss.zones, enemy: r.enemies.find(e => e.id === s.boss.enemyId) || null });
    this.pending = this.pending.filter(p => p.seq > authoritative.ack);
    if (!r.player.dead && s.status === 'playing') for (const p of this.pending) r.player.update(p.dt, inputAdapter(p), p.yaw, g.world);
    if (this.fresh) { g.entities.weapons.seenShot = r.weapon.shotId; this.lastEvent = s.events.at(-1)?.id || 0; this.fresh = false; }
    else for (const e of s.events) if (e.id > this.lastEvent) { this.lastEvent = e.id; if (!['hit', 'hurt'].includes(e.name) || !e.data.playerId || e.data.playerId === this.playerId) g.onEvent(e.name, e.data); }
    const desired = ['upgrade', 'defeat', 'victory'].includes(s.status) ? s.status : this.paused ? 'paused' : 'playing';
    if (g.state.value !== desired || desired === 'upgrade' && this.shownRound !== s.round) { this.show(desired); this.shownRound = s.round; }
    if (desired === 'upgrade') {
      const note = g.ui.overlay.querySelector('.upgrade-note'); if (note) note.textContent = `${authoritative.chosen ? 'Elección recibida · Esperando al equipo' : 'Elige tu mejora'} · ${Math.max(0, Math.ceil((s.deadline - s.serverTime) / 1000))} s`;
      if (authoritative.chosen) g.ui.overlay.querySelectorAll('[data-upgrade]').forEach(b => { b.disabled = true; });
    }
    this.updateTeam();
  }
  show(state) {
    const g = this.game; g.state.value = state; g.input.active = state === 'playing'; g.input.clear();
    if (state !== 'playing') { g.audio.narration?.stop(); g.audio.sceneAudio?.pause(); }
    if (state !== 'playing' && document.pointerLockElement) document.exitPointerLock();
    g.ui.show(state);
    if (state === 'paused') { const p = g.ui.overlay.querySelector('p'); if (p) p.textContent = 'Menú local. El equipo y los enemigos siguen jugando; tu personaje permanece vulnerable.'; }
    if (['victory', 'defeat'].includes(state)) { const restart = g.ui.overlay.querySelector('#restart'); if (restart) { restart.textContent = 'Nueva sala cooperativa'; } const p = document.createElement('p'); p.textContent = 'Expedición online: no modifica fragmentos ni blindaje individual.'; g.ui.overlay.querySelector('.dialog')?.appendChild(p); }
  }
  pause() { if (!this.started || this.game.state.value !== 'playing') return; this.paused = true; this.show('paused'); this.sendNeutral(); }
  resume() { if (this.game.state.value !== 'paused') return; this.paused = false; this.show(this.latest?.status === 'upgrade' ? 'upgrade' : 'playing'); }
  choose(id) { return this.connection.send({ type: 'upgrade', round: this.latest.round, option: id }); }
  action(key) { if (this.game.state.value === 'playing') this.extraActions.push(key); }
  sendNeutral() { this.sendInput(this.step, false); }
  sendInput(dt, enabled) {
    if (!this.started || !this.connected) return;
    const g = this.game, input = g.input, aim = g.camera.shotDirection(g.run, g.save.data.options.assist);
    const message = { type: 'input', seq: ++this.seq, enabled, held: enabled ? HELD.filter(k => input.down(k)) : [], actions: enabled ? [...new Set([...ACTIONS.filter(k => input.take(k)), ...this.extraActions])] : [], yaw: g.camera.yaw, aim: { x: aim.x, y: aim.y, z: aim.z } };
    this.extraActions = [];
    if (!this.connection.send(message)) return;
    this.pending.push({ ...message, dt }); if (this.pending.length > 180) this.pending.shift();
    if (!g.run.player.dead && this.latest.status === 'playing') g.run.player.update(dt, inputAdapter(message), message.yaw, g.world);
  }
  update(dt) {
    const g = this.game;
    if (g.input.take('Escape')) { if (this.paused) this.resume(); else this.pause(); }
    this.accumulator += dt;
    while (this.accumulator >= this.step) { this.sendInput(this.step, g.state.value === 'playing' && !g.loading?.pending && !g.input.rebinding && !g.run.player.dead); this.accumulator -= this.step; }
  }
  interpolate() {
    if (!this.latest || !this.history.length) return;
    const target = performance.now() - 100;
    const a = [...this.history].reverse().find(h => h.at <= target) || this.history[0];
    const b = this.history.find(h => h.at >= target) || this.history.at(-1);
    const t = a === b ? 1 : Math.max(0, Math.min(1, (target - a.at) / (b.at - a.at)));
    const blend = (entity, prev, next) => { if (!prev || !next) return; for (const key of ['x', 'y', 'z']) entity[key] = prev[key] + (next[key] - prev[key]) * t; const diff = Math.atan2(Math.sin(next.yaw - prev.yaw), Math.cos(next.yaw - prev.yaw)); entity.yaw = prev.yaw + diff * t; };
    for (const [id, m] of this.players) if (id !== this.playerId) blend(m.player, a.snapshot.players.find(p => p.id === id), b.snapshot.players.find(p => p.id === id));
    for (const e of this.game.run.enemies) blend(e, a.snapshot.enemies.find(n => n.id === e.id), b.snapshot.enemies.find(n => n.id === e.id));
  }
  cameraPlayer() { return this.game.run.player.dead ? [...this.players.values()].find(m => !m.player.dead && !m.player.abandoned)?.player || this.game.run.player : this.game.run.player; }
  updateTeam() {
    if (!this.team) return; this.team.hidden = !this.started; this.team.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'online-room-heading'; heading.textContent = 'Código de sala · ';
    const code = document.createElement('strong'); code.className = 'online-room-code'; code.textContent = this.code || ''; heading.appendChild(code); this.team.appendChild(heading);
    const connection = document.createElement('div'); connection.textContent = this.connectionState; this.team.appendChild(connection);
    for (const [id, m] of this.players) { const row = document.createElement('div'); row.dataset.playerId = id; row.textContent = `${m.nickname}${id === this.playerId ? ' (tú)' : ''} · ${m.player.dead ? 'Sin señal vital' : `${Math.ceil(m.player.hp)} / ${m.player.stats.maxHp} PV`}${m.connected ? '' : ' · Desconectado'}`; this.team.appendChild(row); }
    if (this.game.run.player.dead) { const row = document.createElement('div'); row.textContent = [...this.players.values()].some(m => !m.player.dead && !m.player.abandoned) ? 'Observando a un compañero vivo' : 'No quedan compañeros vivos'; this.team.appendChild(row); }
  }
  dispose() { this.connection.dispose(); this.game.ui.hud.nodes.hud.append(this.missionPanel, this.vitalsPanel); this.sidebar.remove(); this.team.remove(); this.players.clear(); this.pending = []; this.history = []; }
}
