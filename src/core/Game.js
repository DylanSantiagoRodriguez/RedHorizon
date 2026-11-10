import { MissionView } from '../graphics/MissionView.js';
import { WorldManager } from '../world/WorldManager.js';
import { Renderer } from '../graphics/Renderer.js';
import { Models } from '../graphics/Models.js';
import { CameraController } from '../graphics/CameraController.js';
import { Run } from './Run.js';
import { EntityViews } from '../graphics/EntityViews.js';
import { InputManager } from './InputManager.js';
import { GameLoop } from './GameLoop.js';
import { StateManager } from './StateManager.js';
import { UI } from '../ui/UI.js';
import { SaveSystem } from '../progression/SaveSystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { ParticleSystem } from '../graphics/ParticleSystem.js';
export class Game {
  constructor(container) {
    this.view = new Renderer(container); this.models = new Models(); this.input = new InputManager(this.view.renderer.domElement);
    this.state = new StateManager(); this.camera = new CameraController(this.view.camera);
    this.save = new SaveSystem(); this.audio = new AudioManager(); this.particles = new ParticleSystem(this.view.scene, this.models); this.fps = 60;
    this.createRun('ASTER-09'); this.ui = new UI(this, container); this.missionView = new MissionView(this);
    this.applyOptions();
    this.loop = new GameLoop(dt => this.update(dt), dt => this.render(dt));
    this.view.renderer.setAnimationLoop(t => this.loop.frame(t));
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    window.addEventListener('blur', () => this.pause(), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, options);
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) this.pause(); }, options);
  }
  createRun(seed) {
    this.missionView?.dispose(); this.entities?.dispose(); this.world?.dispose();
    this.world = new WorldManager(this.view.scene, this.models, seed);
    this.run = new Run(this.world, seed, (event, data) => this.onEvent(event, data)); this.entities = new EntityViews(this.view.scene, this.models, data => this.particles.shot(data)); this.camera.ready = false;
    this.run.player.stats.maxHp += this.save.data.armor * 5; this.run.player.hp = this.run.player.stats.maxHp;
    if (this.ui) this.missionView = new MissionView(this);
    this.particles.reset(); this.ui?.hud.reset(); this.audio.boss = false;
  }
  start(seed) {
    const clean = seed?.trim().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);
    this.createRun(clean || `RH-${Math.floor(Math.random() * 999999)}`); this.camera.yaw = 0; this.camera.pitch = 0.1;
    this.change('playing'); this.audio.unlock().catch(() => {}); this.ui.hud.toast('Último soldado: recupera las gemas. Interactuar: ' + this.input.label('KeyE'));
  }
  applyOptions() { const o = this.save.data.options; this.input.bindings = { ...o.bindings }; this.camera.sensitivity = o.sensitivity; this.camera.distance = o.distance; this.view.quality(o.quality); this.audio.setVolume(o.volume); }
  onEvent(event, data) {
    this.audio.play(event, data);
    if (event === 'hit') this.ui?.hud.hit(data);
    if (event === 'hurt') this.ui?.hud.hurt();
    if (['impact', 'death', 'explosion'].includes(event)) this.particles.burst(data, event === 'explosion' ? 35 : event === 'death' ? 16 : 4, data.color, event === 'explosion' ? data.radius * 2 : 5);
    if (event === 'boss') this.ui?.hud.toast('GUARDIÁN INVOCADO · ' + data.name);
    if (event === 'phase') this.ui?.hud.toast('SOBRECARGA · Evita los anillos de impacto');
    if (event === 'beaconReady') this.ui?.hud.toast('5 GEMAS RECUPERADAS · Vuelve a la baliza blanca del punto de partida');
    if (event === 'launch') this.ui?.hud.toast('BALIZA LANZADA · Aurora espera tu señal. Extinción en 60 segundos.');
    if (event === 'extinction') this.input.clear();
    if (event === 'relay') this.ui?.hud.toast('Relé conectado · +35 XP · +30 vida');
  }
  change(state) {
    if (!this.state.set(state)) return;
    this.run.status = state; this.input.active = state === 'playing'; this.input.clear();
    if (state === 'victory' || state === 'defeat') this.save.finish(this.run);
    if (state !== 'playing' && document.pointerLockElement) document.exitPointerLock();
    this.ui.show(state);
  }
  pause() { if (this.state.value === 'playing') this.change('paused'); }
  resume() { if (this.state.value === 'paused') this.change('playing'); }
  menu() { this.change('menu'); }
  chooseUpgrade(id) {
    if (!this.run.chooseUpgrade(id)) return;
    if (this.run.status === 'upgrade') this.ui.show('upgrade'); else this.change('playing');
  }
  update(dt) {
    if (this.input.rebinding) return;
    if (this.input.take('Escape')) { if (this.state.value === 'paused') this.resume(); else this.pause(); }
    if (this.state.value !== 'playing') return;
    this.run.update(dt, this.input, this.camera.yaw, this.camera.shotDirection(this.run, this.save.data.options.assist));
    if (this.run.status !== 'playing') this.change(this.run.status);
  }
  render(dt) {
    this.fps += ((dt > 0 ? 1 / dt : 60) - this.fps) * 0.03;
    this.world.update(this.run.time); this.entities.sync(this.run);
    if (this.state.value === 'menu') { this.view.camera.position.set(8, 4.6, 10); this.view.camera.lookAt(-4, 1.8, -11); }
    else this.camera.update(dt, this.input, this.run.player, this.world);
    if (this.state.value === 'playing' && this.run.mission.phase !== 'cinematic') {
      this.run.player.yaw = Math.PI - this.camera.yaw;
      this.entities.player.rotation.y = this.run.player.yaw;
    }
    this.particles.update(this.state.value === 'playing' ? dt : 0, this.run);
    this.audio.update(dt, this.state.value === 'playing');
    const p = this.run.player; this.view.sun.position.set(p.x - 35, 65, p.z - 25); this.view.sun.target.position.set(p.x, 0, p.z);
    this.ui.update(this.run, dt); this.missionView.update(); this.view.draw();
  }
  dispose() {
    this.ui.cancelBinding?.(); this.missionView.dispose(); this.abort.abort(); this.input.dispose(); this.entities.dispose(); this.world.dispose(); this.particles.dispose(); this.ui.hud.reset(); this.ui.root.remove();
    this.audio.dispose(); this.models.dispose(); this.view.dispose(); this.view.renderer.domElement.remove();
  }
}
