import { DEFAULT_BINDINGS, CONTROLS, rebind, keyLabel } from '../core/Controls.js';
import { HUD } from './HUD.js';
import { UpgradeSelectionGate } from './UpgradeSelectionGate.js';
import { archiveScreen, menuScreen, pauseScreen, upgradeScreen, endScreen, optionsScreen, controlsScreen } from './Screens.js';
export class UI {
  constructor(game, container) {
    this.game = game; this.root = document.createElement('div'); this.root.id = 'interface'; container.appendChild(this.root);
    this.hud = new HUD(game, this.root); this.overlay = this.hud.nodes.overlay; this.show('menu');
  }
  show(state) {
    this.cancelBinding?.();
    this.upgradeGate = state === 'upgrade' ? new UpgradeSelectionGate(performance.now(), this.game.input.bindings.Mouse0) : null;
    this.hud.nodes.hud.hidden = !['playing', 'paused'].includes(state);
    this.hud.nodes.numbers.hidden = state === 'upgrade';
    this.hud.nodes['damage-flash'].hidden = state === 'upgrade';
    this.root.querySelector('.vignette').hidden = state === 'upgrade';
    this.overlay.hidden = state === 'playing'; this.overlay.className = state === 'menu' ? 'home-overlay' : 'modal-overlay';
    if (state === 'playing') return;
    this.overlay.innerHTML = state === 'menu' ? menuScreen(this.game.save) : state === 'paused' ? pauseScreen() : state === 'upgrade' ? upgradeScreen(this.game.run) : endScreen(this.game.run, state === 'victory');
    this.bind();
    if (this.upgradeGate) this.updateUpgradeGate();
  }
  bind() {
    const on = (id, fn) => this.overlay.querySelector('#' + id)?.addEventListener('click', fn);
    on('multiplayer', () => this.game.multiplayer());
    on('start', () => this.game.start(this.overlay.querySelector('#seed')?.value));
    on('restart', () => { if (this.game.online) { this.game.menu(); this.game.multiplayer(); } else this.game.start(); }); on('resume', () => this.game.resume()); on('menu', () => this.game.menu());
    on('options', () => { this.overlay.innerHTML = optionsScreen(this.game.save.data.options); this.overlay.className = 'modal-overlay'; this.bindOptions(); });
    on('controls', () => { this.overlay.innerHTML = controlsScreen(this.game.save.data.options.bindings); this.overlay.className = 'modal-overlay'; this.overlay.querySelector('#back').onclick = () => this.show(this.game.state.value); });
    on('augment-archive', () => { this.overlay.innerHTML = archiveScreen(); this.overlay.className = 'modal-overlay archive-overlay'; this.overlay.querySelector('#back').onclick = () => this.show(this.game.state.value); });
    on('research', () => { if (this.game.save.buyArmor()) this.show('menu'); });
    this.overlay.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
      if (this.game.state.value === 'upgrade' && this.upgradeGate?.ready) this.game.chooseUpgrade(button.dataset.upgrade);
    }));
  }
  bindOptions() {
    const o = this.game.save.data.options;
    this.overlay.oncontextmenu = event => event.preventDefault();
    for (const key of ['volume', 'sensitivity', 'distance', 'quality', 'assist']) this.overlay.querySelector('#' + key).addEventListener('input', e => {
      o[key] = key === 'assist' ? e.target.checked : key === 'quality' ? e.target.value : Number(e.target.value); this.game.applyOptions(); this.game.save.write();
      const output = this.overlay.querySelector('output[for="' + key + '"]');
      if (output) output.textContent = key === 'volume' ? Math.round(o[key] * 100) + '%' : o[key].toFixed(1);
    });
    const refresh = () => this.overlay.querySelectorAll('[data-binding]').forEach(b => { b.textContent = keyLabel(o.bindings[b.dataset.binding]); b.classList.remove('listening'); });
    this.cancelBinding = () => { this.capture?.abort(); this.game.input.rebinding = false; this.game.input.clear(); refresh(); };
    this.overlay.querySelectorAll('[data-settings-tab]').forEach(tab => {
      tab.onclick = () => {
        this.cancelBinding();
        this.overlay.querySelectorAll('[data-settings-tab]').forEach(t => t.setAttribute('aria-pressed', String(t === tab)));
        this.overlay.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== tab.dataset.settingsTab; });
      };
    });
    this.overlay.querySelectorAll('[data-binding]').forEach(button => {
      button.onclick = () => {
        this.cancelBinding(); this.game.input.rebinding = true; this.capture = new AbortController();
        const action = button.dataset.binding, status = this.overlay.querySelector('#binding-status');
        button.textContent = 'Pulsa una tecla…'; button.classList.add('listening');
        status.textContent = 'Asignando: ' + CONTROLS.find(c => c[0] === action)[1] + '. Esc para cancelar.';
        const capture = event => {
          event.preventDefault(); event.stopImmediatePropagation();
          if (event.type === 'keydown' && event.repeat) return;
          const code = event.type === 'mousedown' ? 'Mouse' + event.button : event.code;
          if (code === 'Escape') { this.cancelBinding(); status.textContent = 'Cambio cancelado.'; return; }
          if (event.metaKey || event.altKey || (event.ctrlKey && !code.startsWith('Control'))) { status.textContent = 'Usa una tecla sin combinaciones del sistema.'; return; }
          if (!rebind(o.bindings, action, code)) { status.textContent = 'Tecla reservada o no compatible. Prueba otra; Esc cancela.'; return; }
          if (event.type === 'mousedown' && event.button === 0) window.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, once: true });
          this.cancelBinding(); this.game.applyOptions(); this.game.save.write();
          status.textContent = 'Control guardado: ' + keyLabel(code) + '.';
        };
        window.addEventListener('keydown', capture, { capture: true, signal: this.capture.signal });
        window.addEventListener('mousedown', capture, { capture: true, signal: this.capture.signal });
      };
    });
    this.overlay.querySelector('#reset-bindings').onclick = () => {
      this.cancelBinding(); o.bindings = { ...DEFAULT_BINDINGS }; refresh(); this.game.applyOptions(); this.game.save.write();
      this.overlay.querySelector('#binding-status').textContent = 'Controles predeterminados restaurados.';
    };
    this.overlay.querySelector('#back').onclick = () => { this.cancelBinding(); this.game.save.write(); this.show(this.game.state.value); };
  }
  updateUpgradeGate() {
    const ready = this.upgradeGate.update(performance.now(), this.game.input.physicalHeld, this.game.input.lastActivationAt);
    this.overlay.querySelectorAll('[data-upgrade]').forEach(button => { button.disabled = !ready; });
    const hint = this.overlay.querySelector('#upgrade-selection-hint');
    if (hint) hint.textContent = ready ? 'Elige un aumento para continuar.' : 'Suelta el disparo y espera un momento para elegir.';
  }
  update(run, dt) {
    this.hud.update(run, dt);
    if (this.upgradeGate && !this.upgradeGate.ready) this.updateUpgradeGate();
  }
}
