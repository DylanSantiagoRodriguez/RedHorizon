import { HUD } from './HUD.js';
import { menuScreen, pauseScreen, upgradeScreen, endScreen, optionsScreen, controlsScreen } from './Screens.js';
export class UI {
  constructor(game, container) {
    this.game = game; this.root = document.createElement('div'); this.root.id = 'interface'; container.appendChild(this.root);
    this.hud = new HUD(game, this.root); this.overlay = this.hud.nodes.overlay; this.show('menu');
  }
  show(state) {
    this.hud.nodes.hud.hidden = !['playing', 'paused', 'upgrade'].includes(state);
    this.overlay.hidden = state === 'playing'; this.overlay.className = state === 'menu' ? 'home-overlay' : 'modal-overlay';
    if (state === 'playing') return;
    this.overlay.innerHTML = state === 'menu' ? menuScreen(this.game.save) : state === 'paused' ? pauseScreen() : state === 'upgrade' ? upgradeScreen(this.game.run) : endScreen(this.game.run, state === 'victory');
    this.bind();
  }
  bind() {
    const on = (id, fn) => this.overlay.querySelector('#' + id)?.addEventListener('click', fn);
    on('start', () => this.game.start(this.overlay.querySelector('#seed')?.value));
    on('restart', () => this.game.start()); on('resume', () => this.game.resume()); on('menu', () => this.game.menu());
    on('options', () => { this.overlay.innerHTML = optionsScreen(this.game.save.data.options); this.overlay.className = 'modal-overlay'; this.bindOptions(); });
    on('controls', () => { this.overlay.innerHTML = controlsScreen(); this.overlay.className = 'modal-overlay'; this.overlay.querySelector('#back').onclick = () => this.show(this.game.state.value); });
    on('research', () => { if (this.game.save.buyArmor()) this.show('menu'); });
    this.overlay.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => this.game.chooseUpgrade(button.dataset.upgrade)));
  }
  bindOptions() {
    const o = this.game.save.data.options;
    for (const key of ['volume', 'sensitivity', 'distance', 'quality', 'assist']) this.overlay.querySelector('#' + key).addEventListener('input', e => {
      o[key] = key === 'assist' ? e.target.checked : key === 'quality' ? e.target.value : Number(e.target.value); this.game.applyOptions();
    });
    this.overlay.querySelector('#back').onclick = () => { this.game.save.write(); this.show(this.game.state.value); };
  }
  update(run, dt) { this.hud.update(run, dt); }
}
