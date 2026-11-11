import { loadAurora, frameAurora } from './AuroraModel.js';
import { loadHelmet, frameHelmet } from './HelmetModel.js';
import { loadBeacon } from './BeaconModel.js';
import * as THREE from 'three';

// Original in-engine epilogue: surface, fallen helmet, then the receiving ark.
export class MissionView {
  constructor(game) {
    this.game = game; this.group = new THREE.Group(); game.view.scene.add(this.group);
    this.defaultShadow = { bias: game.view.sun.shadow.bias, normalBias: game.view.sun.shadow.normalBias };
    const m = game.models, h = game.world.heightAt(0, 7);
    this.base = m.part(this.group, 'cylinder', 0x344b54, [0, h + 0.3, 7], [2, 0.6, 2]);
    this.rocket = new THREE.Group(); this.rocket.position.set(0, h + 0.6, 7); this.group.add(this.rocket);
    m.part(this.rocket, 'cylinder', 0xcbd8de, [0, 1.6, 0], [0.5, 3.2, 0.5]);
    m.part(this.rocket, 'cone', 0x8deaff, [0, 3.8, 0], [0.5, 1.2, 0.5], true);
    this.flame = m.part(this.rocket, 'cone', 0x8deaff, [0, -1, 0], [0.4, 2, 0.4], true); this.flame.rotation.z = Math.PI;
    this.sockets = [0xff5060, 0x509dff, 0x50e090, 0xb580ff, 0xffd050].map((color, i) => {
      const a = i * Math.PI * 2 / 5;
      return m.part(this.group, 'rock', color, [Math.sin(a) * 1.6, h + 0.9, 7 + Math.cos(a) * 1.6], [0.22, 0.4, 0.22], true);
    });
    this.beaconReady=loadBeacon(this.group,h).then(beacon=>{
      if(this.disposed){beacon.dispose();return;}
      this.beacon=beacon;this.base.visible=false;this.rocket.visible=false;this.sockets.forEach(s=>{s.visible=false;});
      beacon.update(game.run.mission,game.run.gems);
    }).catch(error=>console.warn('No se pudo cargar la baliza; se mantiene el respaldo.',error));
    this.wave = m.part(this.group, 'sphere', 0xc6faff, [0, 0, 0], [1, 1, 1], true);
    this.helmet = new THREE.Group(); this.helmet.visible = false; this.group.add(this.helmet);
    this.helmetFallback = m.part(this.helmet, 'sphere', 0x53656a, [0, 0, 0], [0.45, 0.4, 0.5]);
    m.part(this.helmetFallback, 'box', 0xd9a34e, [0, 0.1, 0.8], [1.4, 0.45, 0.1]);
    this.helmetReady = loadHelmet(this.helmet).then(helmet => {
      if (this.disposed) { helmet.dispose(); return; }
      this.helmetModel = helmet; this.helmetFallback.visible = false;
    }).catch(error => console.warn('No se pudo cargar el casco; se mantiene el respaldo.', error));
    this.ark = new THREE.Group(); this.ark.position.set(0, 210, -90); this.group.add(this.ark);
    m.part(this.ark, 'box', 0x697c89, [0, 0, 0], [20, 2, 5]);
    m.part(this.ark, 'box', 0x9cb5bf, [0, 2, 0], [8, 2, 3]);
    for (const x of [-8, 8]) m.part(this.ark, 'sphere', 0x8deaff, [x, 0, 3], [1.2, 0.6, 0.4], true);
    this.ark.visible=false;
    this.auroraReady=loadAurora(this.ark).then(aurora=>{
      if(this.disposed){aurora.dispose();return;}
      this.aurora=aurora;
      for(const child of this.ark.children)if(child!==aurora.root)child.visible=false;
    }).catch(error=>console.warn('No se pudo cargar Aurora; se mantiene la nave de respaldo.',error));
    this.altars = game.run.altars.map(altar => {
      const h = game.world.heightAt(altar.x, altar.z), group = new THREE.Group();
      group.position.set(altar.x, h, altar.z); this.group.add(group);
      m.part(group, 'cylinder', 0x333e49, [0, 0.18, 0], [2.4, 0.36, 2.4]);
      for (const x of [-1.6, 1.6]) m.part(group, 'box', 0x51616c, [x, 1.3, 0], [0.5, 2.6, 0.5]);
      const crystal = m.part(group, 'rock', altar.color, [0, 1.6, 0], [0.5, 0.9, 0.5], true);
      return { altar, crystal };
    });
    this.caption = document.createElement('div'); this.caption.className = 'mission-cinema'; this.caption.hidden = true;
    this.caption.innerHTML = '<div class="cinema-top">ASTER / ÚLTIMA TRANSMISIÓN</div><div class="cinema-copy"><small></small><p></p></div>';
    game.ui.root.appendChild(this.caption);
  }
  update() {
    const { run, view, entities, state } = this.game, mission = run.mission;
    const cinema = mission.phase === 'cinematic', visible = state.value === 'playing' && cinema;
    view.backdrop.setMode(cinema && mission.cinematic >= 15 ? 'space' : 'planet');
    const helmetShot = cinema && mission.cinematic >= 5 && mission.cinematic < 15;
    // The close-up needs a smaller shadow offset than the full arena.
    view.sun.shadow.bias = helmetShot ? -.00005 : this.defaultShadow.bias;
    view.sun.shadow.normalBias = helmetShot ? .005 : this.defaultShadow.normalBias;
    this.caption.hidden = !visible;
    this.game.ui.hud.nodes.hud.hidden = cinema || !['playing', 'paused'].includes(state.value);
    for (const { altar, crystal } of this.altars) { crystal.visible = !altar.used; crystal.rotation.y = run.time; }
    const launched = ['countdown', 'cinematic'].includes(mission.phase);
    const elapsed = launched ? 60 - mission.countdown : 0;
    this.rocket.position.y = this.game.world.heightAt(0, 7) + 0.6 + elapsed * elapsed * 0.8;
    this.rocket.visible = !cinema && elapsed < 20; this.flame.visible = launched;
    this.sockets.forEach((mesh, i) => { mesh.position.y = this.game.world.heightAt(0, 7) + 0.9 + (launched ? elapsed * elapsed * 0.8 : 0); mesh.visible = !cinema && elapsed < 20 && (launched || run.gems.some(g => g.color === [0xff5060, 0x509dff, 0x50e090, 0xb580ff, 0xffd050][i] && g.collected)); });
    if(this.beacon){this.base.visible=false;this.rocket.visible=false;this.sockets.forEach(s=>{s.visible=false;});this.beacon.update(mission,run.gems);}
    this.wave.visible = cinema && mission.cinematic < 5; this.helmet.visible = cinema && mission.cinematic < 15; this.ark.visible = cinema && mission.cinematic >= 15;
    entities.player.visible = entities.avatar ? (!cinema || mission.cinematic < 4) : !cinema && !run.player.dead;
    this.game.world.group.visible = !cinema || mission.cinematic < 15;
    if (!cinema) return;
    const t = mission.cinematic, p = run.player;
    if (this.helmetModel) this.helmetModel.place(p.x + 3, p.z + 3, (x, z) => this.game.world.heightAt(x, z));
    else { this.helmetFallback.position.set(p.x + 3, this.game.world.heightAt(p.x + 3, p.z + 3) + 0.4, p.z + 3); this.helmetFallback.rotation.z = 0.6; }
    this.wave.position.set(0, -2, 0); this.wave.scale.setScalar(Math.max(1, t * 65));
    this.caption.querySelector('small').textContent = t < 5 ? '00:00 / EXTINCIÓN GLOBAL' : t < 15 ? 'SIGNOS VITALES: 0' : 'NAVE NODRIZA AURORA / ENLACE CONFIRMADO';
    this.caption.querySelector('p').textContent = t < 5 ? 'La última luz abandonó el planeta.' : t < 15 ? 'Nadie vendría a buscarte. Aun así, cumpliste tu misión.' : '«Recibimos las cinco gemas. Tenemos un mañana.»';
    if (t < 5) { view.camera.position.set(p.x + 12, p.y + 8, p.z + 14); view.camera.lookAt(p.x, p.y, p.z); }
    else if (t < 15) {
      if (this.helmetModel) frameHelmet(view.camera, this.helmetModel.center, this.helmetModel.radius, t);
      else { const target = this.helmetFallback.position; view.camera.position.set(target.x + 2 + (t - 5) * 0.08, target.y + 0.8, target.z + 2.5); view.camera.lookAt(target); }
    }
    else { if(this.aurora)frameAurora(view.camera,this.ark.position,this.aurora.radius,t); else { view.camera.position.set(28 - (t - 15) * 0.6, 221, -65); view.camera.lookAt(this.ark.position); } }
    view.scene.fog.density = t >= 15 ? 0 : 0.012;
  }
  dispose() {
    this.disposed=true;this.beacon?.dispose();this.aurora?.dispose();this.helmetModel?.dispose();
    Object.assign(this.game.view.sun.shadow, this.defaultShadow);
    this.game.world.group.visible = true;
    this.game.view.scene.remove(this.group); this.caption.remove();
    this.game.view.scene.fog.density = 0.0075;
    this.game.view.backdrop.setMode('planet');
  }
}
