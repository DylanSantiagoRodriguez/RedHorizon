import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { difficultyAt } from '../world/DifficultyDirector.js';
import { clock } from './Screens.js';
export class HUD {
  constructor(game, root) {
    this.game = game; this.root = root; this.damageNumbers = []; this.projected = new THREE.Vector3(); this.refresh = 0;
    root.innerHTML = `<div class="vignette"></div><div id="damage-flash"></div><div id="hud" class="neo-hud" hidden>
      <header class="topline"><div class="hud-brand"><span class="brand-symbol">▰</span><b>RED HORIZON</b><small>EXPEDICIÓN <span id="seed-name"></span></small></div><div class="compass"><span>W &nbsp; · &nbsp; · &nbsp; NW &nbsp; · &nbsp; ·</span><b id="bearing">N</b><span>· &nbsp; · &nbsp; NE &nbsp; · &nbsp; · &nbsp; E</span></div><button id="pause-button" aria-label="Pausar">Ⅱ <span>ESC</span></button></header>
      <section class="mission"><span class="eyebrow">PROTOCOLO / ÚLTIMA LUZ</span><h3 id="objective">Invoca a los cinco guardianes</h3><p id="relay-progress">0 / 5 JEFES · 0 / 5 GEMAS</p><div class="gem-sockets" aria-label="Gemas recuperadas"><span data-gem="0" title="Rubí pendiente" style="--gem:#ff5060">◇</span><span data-gem="1" title="Zafiro pendiente" style="--gem:#509dff">◇</span><span data-gem="2" title="Esmeralda pendiente" style="--gem:#50e090">◇</span><span data-gem="3" title="Amatista pendiente" style="--gem:#b580ff">◇</span><span data-gem="4" title="Topacio pendiente" style="--gem:#ffd050">◇</span></div><div class="mission-line"></div><small id="boss-arrival">ALTARES ACTIVADOS · 0 / 5</small></section>
      <section class="telemetry"><div class="time-row"><span>TIEMPO EN SUPERFICIE</span><b id="time">00:00</b></div><div class="threat-row"><i></i><span id="difficulty"></span></div><div class="radar-bezel"><canvas id="radar" width="360" height="360" aria-label="Radar de amenazas, altares, gemas y baliza"></canvas><span class="radar-bolt bolt-nw"></span><span class="radar-bolt bolt-ne"></span><span class="radar-bolt bolt-sw"></span><span class="radar-bolt bolt-se"></span></div><span class="radar-label">ESCÁNER AETHER / 86 M</span><div class="radar-legend"><span>▲ Hostil</span><span>□ Altar</span><span>◆ Gema</span><span>＋ Baliza</span></div></section>
      <div id="boss-bar" hidden><div><span>THE TITAN OF DUST</span><small id="boss-phase">FASE I</small></div><div class="track"><i id="boss-fill"></i></div></div>
      <div class="crosshair"><i></i><b></b><i></i></div><div id="hit-marker" aria-hidden="true">×</div><div id="hurt-feedback" aria-hidden="true"></div><div id="interaction" hidden></div><div id="toast" role="status"></div>
      <section class="vitals"><div class="instrument-label"><span>BIOMETRÍA / 09</span><b id="vital-status">ESTABLE</b></div><div class="pilot-label"><span class="pilot-icon" aria-hidden="true">✚</span><div><b>ÚLTIMO SOLDADO</b><small id="level">NIVEL 01</small></div><strong id="health">120 <small>/ 120</small></strong></div><div class="track hp" id="health-meter" role="progressbar" aria-label="Vida" aria-valuemin="0" aria-valuemax="120" aria-valuenow="120"><i id="hp-fill"></i></div><div class="shield-row"><span>◇ ESCUDO <b id="shield">0</b></span><div class="track"><i id="shield-fill"></i></div></div><div class="xp-row"><span>EVOLUCIÓN</span><div class="track"><i id="xp-fill"></i></div><b id="xp">0 / 32</b></div><div class="run-counters"><span id="kills">0 BAJAS</span><span id="salvage">⌬ 0 FRAGMENTOS</span></div></section>
      <section class="loadout"><div class="instrument-label"><span>ARSENAL / AURORA</span><span id="weapon-status">EN LÍNEA</span></div><div class="weapon-name"><span id="weapon"></span><small id="auto-fire">F · DISPARO CONTINUO: OFF</small></div><div class="slots">${Object.entries(WEAPONS).map(([id, w], i) => `<button data-weapon="${id}" class="weapon-slot" title="${w.name}" aria-label="${w.name}" aria-pressed="false"><kbd>${i + 1}</kbd><svg viewBox="0 0 80 38" aria-hidden="true"><path d="${i === 0 ? 'M8 15h42v-5h16v7h10v5H50l-7 7H32l-5-6H15v10H8z' : i === 1 ? 'M5 13h68v6H46v6H29l-5-5H14v13H5z' : 'M7 9h48v5h18v12H55v5H33l-6-7H19v10H9z'}"/><circle class="weapon-core" cx="${i === 2 ? 38 : 42}" cy="18" r="${i === 2 ? 6 : 4}"/><path class="weapon-trace" d="${i === 1 ? 'M13 10h51M13 23h11' : 'M18 12h14M49 18h17'}"/><circle class="weapon-rivet" cx="19" cy="18" r="1.4"/></svg><span class="slot-name">${['PLASMA','SCATTER','NOVA'][i]}</span></button>`).join('')}<button id="ability-button" class="ability-slot" title="Pulso de resonancia" aria-label="Activar pulso de resonancia"><kbd>Q</kbd><b>◎</b><small id="ability">LISTO</small></button></div><div class="loadout-hint">CLIC DISPARAR &nbsp; / &nbsp; CLIC DER. APUNTAR</div></section>
      <div class="bottom-coordinates">ASTER PLANITIA <span id="coordinates">00.0 / 00.0</span><span id="fps"></span></div></div><div id="numbers"></div><div id="overlay"></div>`;
    this.nodes = Object.fromEntries([...root.querySelectorAll('[id]')].map(n => [n.id, n])); this.radar = this.nodes.radar.getContext('2d');
    this.nodes['pause-button'].onclick = () => game.pause();
    this.nodes['ability-button'].onclick = () => { if (game.state.value === 'playing') game.run.ability.activate(game.run); };
    root.querySelectorAll('[data-weapon]').forEach(b => { b.onclick = () => { if (game.state.value === 'playing') game.run.weapon.equipped = b.dataset.weapon; }; });
  }
  toast(message) { this.nodes.toast.textContent = message; this.nodes.toast.classList.add('visible'); this.toastUntil = performance.now() + 4500; }
  hit(data) {
    const marker = this.nodes['hit-marker'];
    marker.className = 'visible' + (data.killed ? ' kill' : data.critical ? ' critical' : '');
    marker.dataset.label = data.killed ? 'BAJA' : data.critical ? 'CRÍTICO' : '';
    this.hitUntil = performance.now() + (data.killed ? 420 : 240);
    if (this.damageNumbers.length >= 24) return;
    const element = document.createElement('span'); element.textContent = data.amount; element.className = data.critical ? 'damage-number critical' : 'damage-number'; this.nodes.numbers.appendChild(element);
    this.damageNumbers.push({ ...data, element, time: 0 });
  }
  hurt(data = {}) {
    const now = performance.now();
    if (!(now < this.hurtUntil)) { this.receivedHealth = 0; this.receivedShield = 0; }
    this.receivedHealth += data.healthDamage || 0; this.receivedShield += data.shieldDamage || 0;
    const shieldOnly = this.receivedHealth === 0 && this.receivedShield > 0;
    this.nodes['damage-flash'].className = 'visible' + (shieldOnly ? ' shield-hit' : '');
    const feedback = this.nodes['hurt-feedback'];
    feedback.className = 'visible' + (shieldOnly ? ' shield-hit' : '');
    feedback.textContent = [this.receivedHealth > 0 ? '−' + Math.ceil(this.receivedHealth) + ' VIDA' : '', this.receivedShield > 0 ? '−' + Math.ceil(this.receivedShield) + ' ESCUDO' : ''].filter(Boolean).join(' · ');
    this.hurtUntil = now + 500;
  }
  reset() { for (const n of this.damageNumbers) n.element.remove(); this.damageNumbers = []; this.hitUntil = 0; this.hurtUntil = 0; this.receivedHealth = 0; this.receivedShield = 0;
    for (const id of ['hit-marker', 'damage-flash', 'hurt-feedback']) this.nodes[id].className = '';
  }
  update(run, dt) {
    const now = performance.now();
    if (now > this.toastUntil) this.nodes.toast.classList.remove('visible');
    if (now > this.hitUntil) this.nodes['hit-marker'].classList.remove('visible');
    if (now > this.hurtUntil) { this.nodes['damage-flash'].classList.remove('visible'); this.nodes['hurt-feedback'].classList.remove('visible'); }
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const n = this.damageNumbers[i]; n.time += dt;
      if (n.time > 0.7) { n.element.remove(); this.damageNumbers.splice(i, 1); continue; }
      this.projected.set(n.x, n.y + 0.8 + n.time * 1.5, n.z).project(this.game.view.camera);
      n.element.style.display = this.projected.z < -1 || this.projected.z > 1 ? 'none' : 'block';
      n.element.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * innerWidth}px,${(-this.projected.y * 0.5 + 0.5) * innerHeight}px)`;
      n.element.style.opacity = 1 - n.time / 0.7;
    }
    this.refresh += dt; if (this.refresh < 0.08) return; this.refresh = 0;
    const key = code => this.game.input.label(code);
    const n = this.nodes, p = run.player, difficulty = difficultyAt(run.time, run.level);
    n.time.textContent = clock(run.time); n.difficulty.textContent = difficulty.label; n['seed-name'].textContent = run.seed;
    this.root.querySelector('.vitals').classList.toggle('critical', p.hp <= p.stats.maxHp * 0.3);
    n['vital-status'].textContent = p.dead ? 'SIN SEÑAL' : p.hp <= p.stats.maxHp * 0.3 ? 'VIDA CRÍTICA' : 'ESTABLE';
    n['health-meter'].setAttribute('aria-valuemax', p.stats.maxHp);
    n['health-meter'].setAttribute('aria-valuenow', Math.ceil(p.hp));
    this.root.querySelector('.mission').classList.toggle('extinction-warning', run.mission.phase === 'countdown');
    const gemColors = [0xff5060, 0x509dff, 0x50e090, 0xb580ff, 0xffd050];
    this.root.querySelectorAll('[data-gem]').forEach((node, i) => {
      const collected = run.gems.some(g => g.color === gemColors[i] && g.collected);
      node.classList.toggle('collected', collected); node.textContent = collected ? '◆' : '◇';
      node.title = ['Rubí', 'Zafiro', 'Esmeralda', 'Amatista', 'Topacio'][i] + (collected ? ' recuperada' : ' pendiente');
    });
    n['ability-button'].style.setProperty('--charge', Math.max(0, 1 - run.ability.timer / (14 * p.stats.cooldown)) * 360 + 'deg');
    n['ability-button'].setAttribute('aria-label', run.ability.timer > 0 ? 'Pulso recargando: ' + run.ability.timer.toFixed(1) + ' segundos' : 'Activar pulso de resonancia');
    n['weapon-status'].textContent = p.slideTime > 0 ? 'DESLIZANDO / BLOQUEADO' : run.autoFire ? 'AUTO / ACTIVO' : 'MANUAL / EN LÍNEA';
    n.health.innerHTML = `${Math.ceil(p.hp)} <small>/ ${p.stats.maxHp}</small>`; n['hp-fill'].style.width = `${p.hp / p.stats.maxHp * 100}%`;
    n.shield.textContent = Math.ceil(p.shield); n['shield-fill'].style.width = `${p.shield / Math.max(1, p.stats.shield + (run.ability.shieldTime > 0 ? 30 : 0)) * 100}%`;
    n.level.textContent = `NIVEL ${run.level.toString().padStart(2, '0')}`; n.xp.textContent = `${run.experience.xp} / ${run.experience.threshold}`; n['xp-fill'].style.width = `${run.experience.xp / run.experience.threshold * 100}%`;
    n.weapon.textContent = WEAPONS[run.weapon.equipped].short; n.kills.textContent = `${run.kills} BAJAS`; n.salvage.textContent = `⌬ ${run.salvage} FRAGMENTOS`;
    n['auto-fire'].textContent = `${key('KeyF')} · DISPARO CONTINUO: ${run.autoFire ? 'ON' : 'OFF'}`;
    this.root.querySelector('#ability-button kbd').textContent = key('KeyQ');
    this.root.querySelectorAll('[data-weapon] kbd').forEach((node, i) => { node.textContent = key('Digit' + (i + 1)); });
    this.root.querySelector('.loadout-hint').textContent = key('Mouse0') + ' DISPARAR / ' + key('Mouse2') + ' APUNTAR';
    n.ability.textContent = run.ability.timer > 0 ? `${run.ability.timer.toFixed(1)}s` : 'LISTO'; this.nodes['ability-button'].classList.toggle('ready', run.ability.timer <= 0);
    this.root.querySelectorAll('[data-weapon]').forEach(b => { const selected = b.dataset.weapon === run.weapon.equipped; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    n['relay-progress'].textContent = `${run.boss.guardians.filter(b => b.dead).length} / 5 JEFES · ${run.gems.filter(g => g.collected).length} / 5 GEMAS`; n.objective.textContent = run.mission.phase === 'countdown' ? (run.player.dead ? 'Señal vital perdida · Baliza en vuelo' : 'Última resistencia') : run.mission.phase === 'ready' ? 'Lleva las gemas a la baliza' : 'Invoca a los cinco guardianes';
    n['boss-arrival'].textContent = `ALTARES ACTIVADOS · ${run.altars.filter(a => a.used).length} / 5 · ${key('KeyE')} PARA INVOCAR`;
    if (run.mission.phase === 'countdown') n['boss-arrival'].textContent = 'EXTINCIÓN EN ' + clock(Math.ceil(run.mission.countdown));
    n['boss-bar'].hidden = !run.boss.enemy || run.boss.enemy.dead;
    if (run.boss.enemy) { n['boss-bar'].querySelector('span').textContent = run.boss.enemy.name; n['boss-fill'].style.width = `${run.boss.enemy.hp / run.boss.enemy.maxHp * 100}%`; n['boss-phase'].textContent = `FASE ${run.boss.enemy.phase === 1 ? 'I' : 'II · SOBRECARGA'}`; }
    n.interaction.hidden = !run.interaction; if (run.interaction) n.interaction.innerHTML = `<kbd>${key('KeyE')}</kbd> ${run.interaction.type === 'altar' ? 'INVOCAR ' + run.interaction.name.toUpperCase() : run.interaction.type === 'launch' ? (run.mission.phase === 'ready' ? 'INSERTAR 5 GEMAS Y LANZAR BALIZA' : 'BALIZA · NECESITAS LAS 5 GEMAS') : run.interaction.type ? 'CONECTAR ' + run.interaction.name.toUpperCase() : 'RECOGER SUMINISTROS · +45 VIDA'}`;
    n.bearing.textContent = `${((this.game.camera.yaw * 180 / Math.PI % 360 + 360) % 360).toFixed(0)}°`;
    n.coordinates.textContent = `${p.x.toFixed(1)} / ${p.z.toFixed(1)}`; n.fps.textContent = `${Math.round(this.game.fps || 60)} FPS`; this.drawRadar(run);
  }
  drawRadar(run) {
    const c = this.radar;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 180, 180);
    c.save(); c.beginPath(); c.arc(90, 90, 88, 0, Math.PI * 2); c.clip();
    const background = c.createRadialGradient(90, 90, 0, 90, 90, 90);
    background.addColorStop(0, '#142e33'); background.addColorStop(1, '#081218');
    c.fillStyle = background; c.fillRect(0, 0, 180, 180);
    c.lineWidth = 0.6; c.strokeStyle = '#79c4be35';
    for (const radius of [28, 56, 84]) { c.beginPath(); c.arc(90, 90, radius, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(6, 90); c.lineTo(174, 90); c.moveTo(90, 6); c.lineTo(90, 174); c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = i * Math.PI / 30, inner = i % 5 === 0 ? 78 : 82;
      c.strokeStyle = i % 5 === 0 ? '#ccaa7188' : '#ccaa713d';
      c.beginPath(); c.moveTo(90 + Math.sin(a) * inner, 90 + Math.cos(a) * inner);
      c.lineTo(90 + Math.sin(a) * 86, 90 + Math.cos(a) * 86); c.stroke();
    }
    // The sweep is decorative; markers never disappear between sweeps.
    const sweep = run.time * 0.65;
    c.save(); c.translate(90, 90); c.rotate(sweep);
    for (let i = 0; i < 15; i++) {
      c.fillStyle = 'rgba(122,225,210,' + (0.07 * (1 - i / 15)) + ')';
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 84, -i * 0.025 - 0.025, -i * 0.025); c.closePath(); c.fill();
    }
    c.strokeStyle = '#98e1cd66'; c.beginPath(); c.moveTo(0, 0); c.lineTo(84, 0); c.stroke(); c.restore();
    c.font = '7px monospace'; c.textAlign = 'center'; c.fillStyle = '#d4bc91';
    c.fillText('N', 90, 16); c.fillText('S', 90, 171); c.fillText('W', 12, 93); c.fillText('E', 168, 93);
    const marker = (x, z, color, size, kind) => {
      const dx = x - run.player.x, dz = z - run.player.z;
      if (Math.hypot(dx, dz) > 86) return;
      c.save(); c.translate(90 + dx, 90 + dz); c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 1.2;
      c.beginPath();
      if (kind === 'altar') c.strokeRect(-size / 2, -size / 2, size, size);
      else if (kind === 'gem') { c.moveTo(0, -size / 2); c.lineTo(size / 2, 0); c.lineTo(0, size / 2); c.lineTo(-size / 2, 0); c.closePath(); c.fill(); }
      else if (kind === 'beacon') { c.fillRect(-size / 2, -1, size, 2); c.fillRect(-1, -size / 2, 2, size); }
      else if (kind === 'enemy') { c.moveTo(0, -size / 2); c.lineTo(size / 2, size / 2); c.lineTo(-size / 2, size / 2); c.closePath(); c.fill(); }
      else { c.arc(0, 0, size / 2, 0, Math.PI * 2); c.fill(); }
      c.restore();
    };
    for (const e of run.enemies) if (!e.dead) marker(e.x, e.z, e.type === 'titan' ? '#ffd691' : '#fa836f', e.type === 'titan' ? 8 : 4, 'enemy');
    if (!run.launchBeacon.used) marker(0, 7, '#fff5d8', 9, 'beacon');
    for (const a of run.altars) if (!a.used) marker(a.x, a.z, '#' + a.color.toString(16).padStart(6, '0'), 7, 'altar');
    for (const g of run.gems) if (!g.collected) marker(g.x, g.z, '#' + g.color.toString(16).padStart(6, '0'), 8, 'gem');
    for (const b of run.world.beacons) if (!b.used) marker(b.x, b.z, '#96d9c5', 4, 'relay');
    c.save(); c.translate(90, 90); c.rotate(this.game.camera.yaw);
    c.fillStyle = '#eaf9ec'; c.strokeStyle = '#102a2e'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(4, 5); c.lineTo(0, 2); c.lineTo(-4, 5); c.closePath(); c.fill(); c.stroke();
    c.restore(); c.restore();
  }
}
