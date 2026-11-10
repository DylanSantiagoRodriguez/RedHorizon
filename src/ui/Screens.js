import { CONTROLS, keyLabel } from '../core/Controls.js';
import { RARITIES, UPGRADES } from '../data/upgrades.js';
export const clock = t => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
const art = file => import.meta.env.BASE_URL + 'art/' + file;
const brand = '<span class="brand-symbol">▰</span> HORIZON <span class="muted">/ EXPLORATION SYSTEMS</span>';
export function menuScreen(save) {
  const d = save.data;
  return `<div class="menu-shell neo-menu" style="--menu-art:url('${art('menu-aster.jpg')}')">
  <header class="menu-header"><div>${brand}</div><span><i class="status-dot"></i> AURORA / ENLACE EN ESPERA</span></header>
  <section class="hero"><div class="eyebrow"><span class="line"></span> PROTOCOLO 09 · LA ÚLTIMA LUZ</div>
  <h1>RED<br><span>HORIZON</span></h1><div class="hero-rule"><i></i><span>UN SOLDADO. CINCO GEMAS. UN MAÑANA.</span></div>
  <p class="intro">El mundo termina aquí.<br>La esperanza despega contigo.</p>
  <button id="start" class="primary start-button"><span>INICIAR EXPEDICIÓN</span><span>↗</span></button>
  <div class="menu-links"><button id="options">OPCIONES <span>⚙</span></button><button id="controls">CONTROLES <span>＋</span></button></div>
  <button id="augment-archive" class="archive-button"><span>◈</span><span>ARCHIVO DE AUMENTOS<small>15 PIEZAS DE INGENIERÍA</small></span><b>→</b></button>
  <label class="seed-label">SEMILLA <input id="seed" maxlength="32" placeholder="Aleatoria" autocomplete="off"></label></section>
  <aside class="planet-card"><span class="eyebrow">ORDEN DE MISIÓN / 001</span><h3>La última señal</h3>
  <div class="mission-steps"><span><b>01</b> Invoca a los cinco guardianes</span><span><b>02</b> Recupera sus gemas</span><span><b>03</b> Envía la baliza a Aurora</span></div>
  <p class="mission-copy">No habrá extracción.<br>Que tu última luz sea su comienzo.</p></aside>
  <footer class="menu-footer"><span>ASTER PLANITIA <i>•</i> ÚLTIMO SOLDADO ACTIVO</span><div class="research"><span>⌬ ${d.salvage} FRAGMENTOS</span><button id="research" ${d.armor >= 5 || d.salvage < 25 + d.armor * 15 ? 'disabled' : ''}>BLINDAJE ${d.armor}/5 · ${d.armor >= 5 ? 'MÁX.' : `${25 + d.armor * 15} ⌬`}</button><small>+5 vida inicial por módulo</small></div><span>MEJOR REGISTRO <b>${clock(d.best)}</b></span></footer></div>`;
}
export function pauseScreen() { return `<section class="dialog"><span class="eyebrow">ENLACE EN ESPERA</span><h2>Un respiro<br>en el polvo.</h2><p>La simulación está detenida.</p><button id="resume" class="primary">Continuar expedición <span>↗</span></button><button id="options" class="secondary">Opciones</button><button id="controls" class="secondary">Controles</button><button id="menu" class="text-button">Abandonar y volver al inicio</button></section>`; }
function augmentCard(u, index, stacks = 0, interactive = true) {
  const tag = interactive ? 'button' : 'article';
  return `<${tag} class="upgrade-card neo-card ${u.rarity}" ${interactive ? `data-upgrade="${u.id}" aria-label="Instalar ${u.name}: ${u.description}"` : ''}>
  <div class="card-top"><small><i></i>${RARITIES[u.rarity].name}</small><span>RH / ${String(UPGRADES.findIndex(item => item.id === u.id) + 1).padStart(2, '0')}</span></div>
  <div class="augment-art"><img src="${art('augments/' + u.id + '.jpg')}" alt="" loading="${interactive ? 'eager' : 'lazy'}" decoding="async" width="768" height="768"><span class="art-index">0${index + 1}</span><span class="art-emblem" aria-hidden="true">${u.icon}</span></div>
  <div class="augment-copy"><span class="augment-label">AUMENTO / ${u.stat === 'maxHp' || u.stat === 'regen' || u.stat === 'shield' ? 'SUPERVIVENCIA' : u.stat === 'speed' ? 'MOVILIDAD' : 'COMBATE'}</span><h3>${u.name}</h3><p>${u.description}</p>
  <div class="module-track" aria-hidden="true">${Array.from({ length: u.max }, (_, i) => `<i class="${i < stacks ? 'installed' : i === stacks && interactive ? 'next' : ''}"></i>`).join('')}</div>
  <div class="card-bottom"><span>${interactive ? `MÓDULO ${stacks + 1} / ${u.max}` : `HASTA ${u.max} MÓDULOS`}</span><b>${interactive ? 'INSTALAR ↗' : 'ARCHIVO ◈'}</b></div></div></${tag}>`;
}
export function upgradeScreen(run) {
  return `<section class="upgrade-panel neo-upgrades"><header><span class="eyebrow">TALLER DE CAMPAÑA / NIVEL ${run.level.toString().padStart(2, '0')}</span><h2>Forja tu siguiente ventaja.</h2><p>Tres posibilidades. Una elección. El combate está en pausa.</p></header><div class="cards">${run.upgrades.offers.map((u, i) => augmentCard(u, i, run.upgrades.stacks[u.id] || 0)).join('')}</div><div class="upgrade-note"><span></span>TECNOLOGÍA RECUPERADA · FUTURO RECONSTRUIDO<span></span></div></section>`;
}
export function archiveScreen() {
  return `<section class="augment-archive"><header><div><span class="eyebrow">AURORA / ARCHIVO DE INGENIERÍA</span><h2>El arte de sobrevivir.</h2><p>Conoce los 15 aumentos. Durante la expedición, subir de nivel te permite instalar uno de tres módulos.</p></div><button id="back" class="secondary">Volver al menú ↗</button></header><div class="archive-cards">${UPGRADES.map((u, i) => augmentCard(u, i, 0, false)).join('')}</div></section>`;
}
export function endScreen(run, victory) {
  return `<section class="dialog result"><span class="eyebrow">EXPEDICIÓN ${victory ? 'COMPLETADA' : 'FINALIZADA'} / ${run.seed}</span><h2>${victory ? 'La última luz' : 'Señal perdida'}</h2><p>${victory ? 'Aurora recibió las cinco gemas. La vida en Aster se extinguió, pero tu señal llevó un futuro a la humanidad.' : 'La baliza no llegó a despegar. La última esperanza quedó en la superficie.'}</p><div class="result-stats"><div><b>${clock(run.time)}</b><span>TIEMPO</span></div><div><b>${run.kills}</b><span>BAJAS</span></div><div><b>${run.level}</b><span>NIVEL</span></div><div><b>+${run.salvage}</b><span>FRAGMENTOS</span></div></div><button id="restart" class="primary">Nueva expedición <span>↗</span></button><button id="menu" class="secondary">Volver al inicio</button></section>`;
}
export function optionsScreen(options) {
  return `<section class="dialog settings"><header><span class="eyebrow">CONFIGURACIÓN DE MISIÓN</span><h2>A tu manera.</h2><p>Ajusta la experiencia y configura cada acción.</p></header>
  <nav class="settings-tabs" aria-label="Categorías de opciones"><button type="button" data-settings-tab="general" aria-pressed="true">Imagen y sonido</button><button type="button" data-settings-tab="bindings" aria-pressed="false">Controles</button></nav>
  <div data-settings-panel="general">
  <label>Volumen <input id="volume" type="range" min="0" max="1" step="0.05" value="${options.volume}"><output for="volume">${Math.round(options.volume * 100)}%</output></label>
  <label>Sensibilidad <input id="sensitivity" type="range" min="0.3" max="2.5" step="0.1" value="${options.sensitivity}"><output for="sensitivity">${options.sensitivity.toFixed(1)}</output></label>
  <label>Distancia de cámara <input id="distance" type="range" min="4" max="12" step="0.5" value="${options.distance}"><output for="distance">${options.distance.toFixed(1)}</output></label>
  <label>Calidad gráfica<select id="quality"><option value="high" ${options.quality === 'high' ? 'selected' : ''}>Alta · sombras</option><option value="low" ${options.quality === 'low' ? 'selected' : ''}>Baja · rendimiento</option></select></label>
  <label>Asistencia de apuntado<input id="assist" type="checkbox" ${options.assist ? 'checked' : ''}></label>
  </div>
  <div data-settings-panel="bindings" hidden><p>Selecciona una acción y pulsa una tecla o un botón del ratón. Si ya está asignado, se intercambian las dos acciones. Esc cancela; durante el juego, Esc siempre pausa.</p>
  <div class="binding-grid">${['Movimiento', 'Combate', 'Equipo'].map(group => `<section class="binding-group"><h3>${group}</h3>${CONTROLS.filter(c => c[2] === group).map(([code, label]) => `<div class="binding-row"><span>${label}</span><button type="button" data-binding="${code}" aria-label="Cambiar ${label}">${keyLabel(options.bindings[code])}</button></div>`).join('')}</section>`).join('')}</div>
  <p id="binding-status" role="status">Los cambios se guardan en este navegador.</p><button type="button" id="reset-bindings" class="secondary">Restaurar controles predeterminados</button></div>
  <footer><button id="back" class="primary">Guardar y volver ↗</button></footer></section>`;
}
export function controlsScreen(bindings) {
  return `<section class="dialog controls"><span class="eyebrow">MANUAL DEL EXPLORADOR</span><h2>Cada segundo cuenta.</h2><div class="control-grid">${CONTROLS.map(([code, label]) => `<kbd>${keyLabel(bindings[code])}</kbd><span>${label}</span>`).join('')}<kbd>Esc</kbd><span>Pausar / liberar ratón</span></div><p>Mantén salto para encadenar bunnyhop. Deslízate mientras llevas velocidad. Puedes cambiar estos controles en Opciones.</p><button id="back" class="primary">Entendido ↗</button></section>`;
}
