import * as THREE from 'three';
import { loadPlayerAvatar } from './PlayerAvatar.js';
import { WeaponModels } from './WeaponModels.js';
import { CONFIG } from '../config.js';
export class EntityViews {
  constructor(scene, models, emitShotParticles) {
    this.scene = scene; this.models = models; this.enemies = new Map(); this.free = new Map(); this.gems = new Map();
    this.player = models.player(); scene.add(this.player);
    this.weapons = new WeaponModels(models, this.player.userData.gun); this.emitShotParticles = emitShotParticles;
    this.disposed = false;
    this.avatarReady = loadPlayerAvatar(this.player).then(avatar => {
      if (this.disposed) { avatar.dispose(); return; }
      this.avatar = avatar;
      for (const child of this.player.children) if (child !== avatar.root && child !== this.player.userData.gun) child.visible = false;
    }).catch(error => { if (!this.disposed) console.warn('No se pudo cargar el personaje; se mantiene el modelo de respaldo.', error); });
    this.projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.projectiles = new THREE.InstancedMesh(models.geometry('sphere'), this.projectileMaterial, CONFIG.projectileLimit);
    this.projectiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.projectiles.frustumCulled = false; scene.add(this.projectiles);
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
  }
  sync(run) {
    for (const g of run.gems) {
      let mesh = this.gems.get(g.id);
      if (!mesh) { mesh = this.models.part(this.scene, 'rock', g.color, [g.x, 0, g.z], [0.55, 0.95, 0.55], true); this.gems.set(g.id, mesh); }
      mesh.visible = !g.collected; mesh.rotation.y = run.time;
      mesh.position.y = run.world.heightAt(g.x, g.z) + 1 + Math.sin(run.time * 3) * 0.2;
    }
    this.models.animatePlayer(this.player, run.player, run.time);
    this.avatar?.update(run.player, run.time);
    this.weapons.update(run, this.emitShotParticles);
    for (const [id, mesh] of this.enemies) {
      if (!run.enemies.some(e => e.id === id && !e.dead)) {
        mesh.visible = false; this.enemies.delete(id);
        const type = mesh.userData.type; if (!this.free.has(type)) this.free.set(type, []); this.free.get(type).push(mesh);
      }
    }
    for (const e of run.enemies) {
      if (e.dead) continue;
      let mesh = this.enemies.get(e.id);
      if (!mesh) {
        mesh = this.free.get(e.type)?.pop() || this.models.enemy(e); mesh.userData.type = e.type;
        this.enemies.set(e.id, mesh); this.scene.add(mesh); mesh.visible = true;
      }
      mesh.position.set(e.x, e.y + (e.type === 'drone' ? Math.sin(run.time * 3 + e.id) * 0.2 : 0), e.z); mesh.rotation.y = e.yaw;
      if (e.type !== 'drone') { mesh.position.y += Math.sin(run.time * e.speed * 2 + e.id) * 0.045; mesh.rotation.z = Math.sin(run.time * e.speed + e.id) * 0.025; }
      mesh.userData.limbs.forEach((limb, i) => { limb.rotation.x = Math.sin(run.time * e.speed * 2 + i * 2) * 0.2; });
      mesh.visible = e.flash <= 0 || Math.floor(run.time * 35) % 2 === 0;
    }
    let count = 0;
    for (const p of run.combat.pool.items) {
      if (!p.active) continue;
      this.dummy.position.set(p.x, p.y, p.z); this.dummy.scale.set(p.radius, p.radius, p.radius * (p.kind === 'plasma' ? 4 : p.kind === 'scatter' ? 1.8 : p.kind === 'nova' ? 1.2 : 1.4));
      this.dummy.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz); this.dummy.updateMatrix();
      this.projectiles.setMatrixAt(count, this.dummy.matrix); this.projectiles.setColorAt(count, this.color.setHex(p.color)); count++;
    }
    this.projectiles.count = count; this.projectiles.instanceMatrix.needsUpdate = true;
    if (this.projectiles.instanceColor) this.projectiles.instanceColor.needsUpdate = true;
  }
  dispose() {
    this.disposed = true; this.avatar?.dispose();
    this.scene.remove(this.player, this.projectiles); this.projectiles.dispose(); this.projectileMaterial.dispose();
    for (const mesh of this.enemies.values()) this.scene.remove(mesh);
    for (const meshes of this.free.values()) for (const mesh of meshes) this.scene.remove(mesh);
    for (const mesh of this.gems.values()) this.scene.remove(mesh);
    this.gems.clear();
    this.enemies.clear(); this.free.clear();
  }
}
