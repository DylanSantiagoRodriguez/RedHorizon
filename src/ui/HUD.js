import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { difficultyAt } from '../world/DifficultyDirector.js';
import { clock } from './Screens.js';
export class HUD {
  constructor(game, root) {
    this.game = game; this.root = root; this.damageNumbers = []; this.projected = new THREE.Vector3(); this.refresh = 0;
    root.innerHTML = `<div class="vignette"></div><div id="damage-flash"></div><div id="hud" hidden>
      <header class="topline"><div class="hud-brand"><span class="brand-symbol">▰</span><b>RED HORIZON</b><small>EXPEDICIÓN <span id="seed-name"></span></small></div><div class="compass"><span>W &nbsp; · &nbsp; · &nbsp; NW &nbsp; · &nbsp; ·</span><b id="bearing">N</b><span>· &nbsp; · &nbsp; NE &nbsp; · &nbsp; · &nbsp; E</span></div><button id="pause-button" aria-label="Pausar">Ⅱ <span>ESC</span></button></header>
      <section class="mission"><span class="eyebrow">OBJETIVO DE EXPEDICIÓN</span><h3 id="objective">Reconecta los relés</h3><p id="relay-progress">0 / 3 RELÉS ACTIVADOS</p><div class="mission-line"></div><small id="boss-arrival">LLEGADA DEL TITÁN · 06:00</small></section>
      <section class="telemetry"><div class="time-row"><span>TIEMPO EN SUPERFICIE</span><b id="time">00:00</b></div><div class="threat-row"><i></i><span id="difficulty"></span></div><canvas id="radar" width="180" height="180" aria-label="Radar de enemigos y relés"></canvas><span class="radar-label">RADAR LOCAL · 90 M</span></section>
      <div id="boss-bar" hidden><div><span>THE TITAN OF DUST</span><small id="boss-phase">FASE I</small></div><div class="track"><i id="boss-fill"></i></div></div>
      <div class="crosshair"><i></i><b></b><i></i></div><div id="hit-marker">×</div><div id="interaction" hidden></div><div id="toast" role="status"></div>
      <section class="vitals"><div class="pilot-label"><span class="pilot-icon">⌘</span><div><b>EXPLORADOR / 09</b><small id="level">NIVEL 01</small></div><strong id="health">120 <small>/ 120</small></strong></div><div class="track hp"><i id="hp-fill"></i></div><div class="shield-row"><span>◇ ESCUDO <b id="shield">0</b></span><div class="track"><i id="shield-fill"></i></div></div><div class="xp-row"><span>EVOLUCIÓN</span><div class="track"><i id="xp-fill"></i></div><b id="xp">0 / 32</b></div><div class="run-counters"><span id="kills">0 BAJAS</span><span id="salvage">⌬ 0 FRAGMENTOS</span></div></section>
      <section class="loadout"><div class="weapon-name"><span id="weapon"></span><small id="auto-fire">F · DISPARO CONTINUO: OFF</small></div><div class="slots">${Object.entries(WEAPONS).map(([id, w], i) => `<button data-weapon="${id}" class="weapon-slot" title="${w.name}"><kbd>${i + 1}</kbd><svg viewBox="0 0 80 38" aria-hidden="true"><path d="${i === 0 ? 'M8 15h42v-5h16v7h10v5H50l-7 7H32l-5-6H15v10H8z' : i === 1 ? 'M5 13h68v6H46v6H29l-5-5H14v13H5z' : 'M7 9h48v5h18v12H55v5H33l-6-7H19v10H9z'}"/></svg></button>`).join('')}<button id="ability-button" class="ability-slot" title="Pulso de resonancia"><kbd>Q</kbd><b>◎</b><small id="ability">LISTO</small></button></div><div class="loadout-hint">CLIC DISPARAR &nbsp; / &nbsp; CLIC DER. APUNTAR</div></section>
      <div class="bottom-coordinates">ASTER PLANITIA <span id="coordinates">00.0 / 00.0</span><span id="fps"></span></div></div><div id="numbers"></div><div id="overlay"></div>`;
    this.nodes = Object.fromEntries([...root.querySelectorAll('[id]')].map(n => [n.id, n])); this.radar = this.nodes.radar.getContext('2d');
    this.nodes['pause-button'].onclick = () => game.pause();
    this.nodes['ability-button'].onclick = () => { if (game.state.value === 'playing') game.run.ability.activate(game.run); };
    root.querySelectorAll('[data-weapon]').forEach(b => { b.onclick = () => { if (game.state.value === 'playing') game.run.weapon.equipped = b.dataset.weapon; }; });
  }
  toast(message) { this.nodes.toast.textContent = message; this.nodes.toast.classList.add('visible'); this.toastUntil = performance.now() + 4500; }
  hit(data) {
    this.nodes['hit-marker'].classList.add('visible'); this.hitUntil = performance.now() + 100;
    if (this.damageNumbers.length >= 24) return;
    const element = document.createElement('span'); element.textContent = data.amount; element.className = data.critical ? 'damage-number critical' : 'damage-number'; this.nodes.numbers.appendChild(element);
    this.damageNumbers.push({ ...data, element, time: 0 });
  }
  hurt() { this.nodes['damage-flash'].classList.add('visible'); this.hurtUntil = performance.now() + 220; }
  reset() { for (const n of this.damageNumbers) n.element.remove(); this.damageNumbers = []; }
  update(run, dt) {
    const now = performance.now();
    if (now > this.toastUntil) this.nodes.toast.classList.remove('visible');
    if (now > this.hitUntil) this.nodes['hit-marker'].classList.remove('visible');
    if (now > this.hurtUntil) this.nodes['damage-flash'].classList.remove('visible');
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const n = this.damageNumbers[i]; n.time += dt;
      if (n.time > 0.7) { n.element.remove(); this.damageNumbers.splice(i, 1); continue; }
      this.projected.set(n.x, n.y + 0.8 + n.time * 1.5, n.z).project(this.game.view.camera);
      n.element.style.display = this.projected.z < -1 || this.projected.z > 1 ? 'none' : 'block';
      n.element.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * innerWidth}px,${(-this.projected.y * 0.5 + 0.5) * innerHeight}px)`;
      n.element.style.opacity = 1 - n.time / 0.7;
    }
    this.refresh += dt; if (this.refresh < 0.08) return; this.refresh = 0;
    const n = this.nodes, p = run.player, difficulty = difficultyAt(run.time, run.level);
    n.time.textContent = clock(run.time); n.difficulty.textContent = difficulty.label; n['seed-name'].textContent = run.seed;
    n.health.innerHTML = `${Math.ceil(p.hp)} <small>/ ${p.stats.maxHp}</small>`; n['hp-fill'].style.width = `${p.hp / p.stats.maxHp * 100}%`;
    n.shield.textContent = Math.ceil(p.shield); n['shield-fill'].style.width = `${p.shield / Math.max(30, p.stats.shield + 30) * 100}%`;
    n.level.textContent = `NIVEL ${run.level.toString().padStart(2, '0')}`; n.xp.textContent = `${run.experience.xp} / ${run.experience.threshold}`; n['xp-fill'].style.width = `${run.experience.xp / run.experience.threshold * 100}%`;
    n.weapon.textContent = WEAPONS[run.weapon.equipped].short; n.kills.textContent = `${run.kills} BAJAS`; n.salvage.textContent = `⌬ ${run.salvage} FRAGMENTOS`;
    n['auto-fire'].textContent = `F · DISPARO CONTINUO: ${run.autoFire ? 'ON' : 'OFF'}`;
    n.ability.textContent = run.ability.timer > 0 ? `${run.ability.timer.toFixed(1)}s` : 'LISTO'; this.nodes['ability-button'].classList.toggle('ready', run.ability.timer <= 0);
    this.root.querySelectorAll('[data-weapon]').forEach(b => b.classList.toggle('selected', b.dataset.weapon === run.weapon.equipped));
    n['relay-progress'].textContent = `${run.boss.guardians.filter(b => b.dead).length} / 5 JEFES · ${run.gems.filter(g => g.collected).length} / 5 GEMAS`; n.objective.textContent = 'Derrota a los cinco jefes';
    n['boss-arrival'].textContent = run.boss.spawned ? 'GEMAS: RUBÍ · ZAFIRO · ESMERALDA · AMATISTA · TOPACIO' : `LLEGADA DEL TITÁN · ${clock(Math.max(0, 360 - run.time))}`;
    n['boss-bar'].hidden = !run.boss.enemy || run.boss.enemy.dead;
    if (run.boss.enemy) { n['boss-bar'].querySelector('span').textContent = run.boss.enemy.name; n['boss-fill'].style.width = `${run.boss.enemy.hp / run.boss.enemy.maxHp * 100}%`; n['boss-phase'].textContent = `FASE ${run.boss.enemy.phase === 1 ? 'I' : 'II · SOBRECARGA'}`; }
    n.interaction.hidden = !run.interaction; if (run.interaction) n.interaction.innerHTML = `<kbd>E</kbd> ${run.interaction.type ? 'CONECTAR ' + run.interaction.name.toUpperCase() : 'RECOGER SUMINISTROS · +45 VIDA'}`;
    n.bearing.textContent = `${((this.game.camera.yaw * 180 / Math.PI % 360 + 360) % 360).toFixed(0)}°`;
    n.coordinates.textContent = `${p.x.toFixed(1)} / ${p.z.toFixed(1)}`; n.fps.textContent = `${Math.round(this.game.fps || 60)} FPS`; this.drawRadar(run);
  }
  drawRadar(run) {
    const c = this.radar; c.clearRect(0, 0, 180, 180); c.fillStyle = '#111d1b99'; c.fillRect(0, 0, 180, 180); c.strokeStyle = '#b9d2c522'; c.lineWidth = 1;
    for (const r of [30, 60, 86]) { c.beginPath(); c.arc(90, 90, r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(90, 0); c.lineTo(90, 180); c.moveTo(0, 90); c.lineTo(180, 90); c.stroke();
    const dot = (x, z, color, size) => { const dx = x - run.player.x, dz = z - run.player.z; if (Math.hypot(dx, dz) > 86) return; c.fillStyle = color; c.fillRect(90 + dx - size / 2, 90 + dz - size / 2, size, size); };
    for (const e of run.enemies) if (!e.dead) dot(e.x, e.z, e.type === 'titan' ? '#ffdf8f' : '#ff8264', e.type === 'titan' ? 7 : 3);
    for (const g of run.gems) if (!g.collected) dot(g.x, g.z, '#' + g.color.toString(16).padStart(6, '0'), 8);
    for (const b of run.world.beacons) if (!b.used) dot(b.x, b.z, '#a2f7d6', 6);
    c.save(); c.translate(90, 90); c.rotate(this.game.camera.yaw); c.fillStyle = '#f0f3df'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(0, 2); c.lineTo(-4, 4); c.closePath(); c.fill(); c.restore();
  }
}
