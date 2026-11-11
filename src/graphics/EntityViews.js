import { softenEnemyMaterials } from './EnemyAppearance.js';
import { isAmethyst } from '../data/amethystAnimations.js';
import { loadAmethystAvatar } from './AmethystAvatar.js';
import { isEmerald } from '../data/emeraldAnimations.js';
import { loadEmeraldAvatar } from './EmeraldAvatar.js';
import { isSapphire } from '../data/sapphireAnimations.js';
import { loadSapphireAvatar } from './SapphireAvatar.js';
import { isRuby } from '../data/rubyAnimations.js';
import { loadRubyAvatar } from './RubyAvatar.js';
import * as THREE from 'three';
import { loadPlayerAvatar } from './PlayerAvatar.js';
import { WeaponModels } from './WeaponModels.js';
import { enemyModelKey } from '../data/guardians.js';
import { animateGuardian } from './EnemyModels.js';
import { CONFIG } from '../config.js';
import { isDust } from '../data/dustAnimations.js';
import { loadDustAvatar } from './DustAvatar.js';
import { loadStalkerAvatar } from './StalkerAvatar.js';
import { loadBruteAvatar } from './BruteAvatar.js';
import { loadSpitterAvatar } from './SpitterAvatar.js';
import { loadDroneAvatar } from './DroneAvatar.js';
import { loadElteAvatar } from './ElteAvatar.js';
export class EntityViews {
  constructor(scene, models, emitShotParticles) {
    this.scene = scene; this.models = models; this.enemies = new Map(); this.free = new Map(); this.gems = new Map();
    this.player = models.player(); scene.add(this.player);
    this.weapons = new WeaponModels(models, this.player.userData.gun); this.emitShotParticles = emitShotParticles;
    this.disposed = false; this.remotePlayers = new Map();
    this.amethystAvatars = new Map(); this.emeraldAvatars = new Map(); this.sapphireAvatars = new Map(); this.rubyAvatars = new Map(); this.dustAvatars = new Map(); this.stalkerAvatars = new Map(); this.bruteAvatars = new Map(); this.elteAvatars = new Map(); this.spitterAvatars = new Map(); this.droneAvatars = new Map(); this.corpses = new Map(); this.enemyData = new Map();
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
  syncPlayers(players, localId, run, dt) {
    for (const [id, member] of players) {
      if (id === localId) continue;
      let view = this.remotePlayers.get(id);
      if (!view) {
        const mesh = this.models.player(); this.scene.add(mesh);
        view = { mesh, loading: true, weapons: new WeaponModels(this.models, mesh.userData.gun) }; this.remotePlayers.set(id, view); view.weapons.seenShot = member.weapon.shotId;
        loadPlayerAvatar(mesh).then(avatar => {
          if (this.disposed || !this.remotePlayers.has(id)) { avatar.dispose(); return; }
          view.avatar = avatar;
          for (const child of mesh.children) if (child !== avatar.root && child !== mesh.userData.gun) child.visible = false;
        }).catch(() => {}).finally(() => { view.loading = false; });
      }
      const context = { ...run, player: member.player, weapon: member.weapon, ability: member.ability };
      this.models.animatePlayer(view.mesh, member.player); view.avatar?.update(context, dt); view.weapons.update(context, this.emitShotParticles, view.avatar);
      view.mesh.visible = !view.loading && (run.mission.phase !== 'cinematic' || run.mission.cinematic < 4);
    }
    for (const [id, view] of this.remotePlayers) if (!players.has(id)) { view.avatar?.dispose(); this.scene.remove(view.mesh); this.remotePlayers.delete(id); }
  }
  sync(run, dt = 0) {
    for (const g of run.gems) {
      let mesh = this.gems.get(g.id);
      if (!mesh) { mesh = this.models.part(this.scene, 'rock', g.color, [g.x, 0, g.z], [0.55, 0.95, 0.55], true); this.gems.set(g.id, mesh); }
      mesh.visible = !g.collected; mesh.rotation.y = run.time;
      mesh.position.y = run.world.heightAt(g.x, g.z) + 1 + Math.sin(run.time * 3) * 0.2;
    }
    this.models.animatePlayer(this.player, run.player);
    this.avatar?.update(run, dt);
    this.weapons.update(run, this.emitShotParticles, this.avatar);
    for (const [id, mesh] of this.enemies) {
      if (!run.enemies.some(e => e.id === id && !e.dead)) {
        this.enemies.delete(id);
        const enemy = this.enemyData.get(id); this.enemyData.delete(id);
        if (enemy?.dead && (this.animatedAvatar(mesh) || mesh.userData.amethystLoading || isAmethyst(enemy) || mesh.userData.emeraldLoading || mesh.userData.sapphireLoading || mesh.userData.rubyLoading || mesh.userData.stalkerLoading || mesh.userData.bruteLoading || mesh.userData.elteLoading || mesh.userData.spitterLoading || enemy.type === 'drone')) { if (enemy.type === 'drone') enemy.droneDeathAt ??= run.time; if (isAmethyst(enemy)) enemy.amethystDeathAt ??= run.time; this.corpses.set(mesh, enemy); mesh.visible = true; continue; }
        mesh.visible = false; this.animatedAvatar(mesh)?.reset();
        const type = mesh.userData.modelKey; if (!this.free.has(type)) this.free.set(type, []); this.free.get(type).push(mesh);
      }
    }
    for (const [mesh, enemy] of this.corpses) {
      const avatar = this.animatedAvatar(mesh);
      let fallbackDone = false;
      if ((enemy.type === 'drone' || isAmethyst(enemy)) && !avatar) {
        const elapsed = Math.max(0, run.time - (isAmethyst(enemy) ? enemy.amethystDeathAt : enemy.droneDeathAt)), ground = run.world.heightAt(enemy.x, enemy.z) + enemy.radius;
        mesh.position.y = Math.max(ground, enemy.y - 4.905 * elapsed * elapsed);
        const fallTime = Math.sqrt(Math.max(0, enemy.y - ground) / 4.905);
        fallbackDone = elapsed >= Math.max(2.2, fallTime + .5);
      }
      if ((!avatar && !isAmethyst(enemy) && !mesh.userData.amethystLoading && !mesh.userData.emeraldLoading && !mesh.userData.sapphireLoading && !mesh.userData.rubyLoading && !mesh.userData.stalkerLoading && !mesh.userData.bruteLoading && !mesh.userData.spitterLoading && enemy.type !== 'drone') || fallbackDone || avatar?.update(enemy, run.time, run.world)) {
        this.corpses.delete(mesh);
        if (enemy.type === 'stalker' || enemy.type === 'brute' || enemy.type === 'elite' || enemy.type === 'spitter' || enemy.type === 'drone') {
          avatar?.reset(); mesh.visible = false;
          const key = mesh.userData.modelKey; if (!this.free.has(key)) this.free.set(key, []); this.free.get(key).push(mesh);
        } else { avatar?.dispose(); this.amethystAvatars.delete(mesh); this.emeraldAvatars.delete(mesh); this.sapphireAvatars.delete(mesh); this.rubyAvatars.delete(mesh); this.dustAvatars.delete(mesh); this.scene.remove(mesh); }
      }
    }
    for (const e of run.enemies) {
      if (e.dead) continue;
      let mesh = this.enemies.get(e.id);
      if (!mesh) {
        const key = enemyModelKey(e);
        mesh = this.free.get(key)?.pop() || this.models.enemy(e); mesh.userData.modelKey = key;
        this.enemies.set(e.id, mesh); this.scene.add(mesh); mesh.visible = true;
        if (e.type === 'stalker' && !mesh.userData.stalkerLoading && !this.stalkerAvatars.has(mesh)) {
          mesh.userData.stalkerLoading = true;
          mesh.userData.stalkerReady = loadStalkerAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.stalkerAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            // Remove fallback sway even if the creature died while loading.
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar stalker; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.stalkerLoading = false; });
        }
        if (e.type === 'brute' && !mesh.userData.bruteLoading && !this.bruteAvatars.has(mesh)) {
          mesh.userData.bruteLoading = true;
          mesh.userData.bruteReady = loadBruteAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.bruteAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            // Remove fallback sway even if the creature died while loading.
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar brute; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.bruteLoading = false; });
        }
        if (e.type === 'elite' && !mesh.userData.elteLoading && !this.elteAvatars.has(mesh)) {
          mesh.userData.elteLoading = true;
          mesh.userData.elteReady = loadElteAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.elteAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            // Remove fallback sway even if the creature died while loading.
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar elte; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.elteLoading = false; });
        }
        if (e.type === 'spitter' && !mesh.userData.spitterLoading && !this.spitterAvatars.has(mesh)) {
          mesh.userData.spitterLoading = true;
          mesh.userData.spitterReady = loadSpitterAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.spitterAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            // Remove fallback sway even if the creature died while loading.
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar spitter; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.spitterLoading = false; });
        }
        if (e.type === 'drone' && !mesh.userData.droneLoading && !this.droneAvatars.has(mesh)) {
          mesh.userData.droneLoading = true;
          mesh.userData.droneReady = loadDroneAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.droneAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            // Remove fallback sway even if the creature died while loading.
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar drone; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.droneLoading = false; });
        }
        if (isAmethyst(e) && !mesh.userData.amethystLoading && !this.amethystAvatars.has(mesh)) {
          mesh.userData.amethystLoading = true;
          mesh.userData.amethystReady = loadAmethystAvatar(mesh).then(avatar => {
            if (this.disposed || !mesh.parent) { avatar.dispose(); return; }
            this.amethystAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar amethyst; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.amethystLoading = false; });
        }
        if (isEmerald(e) && !mesh.userData.emeraldLoading && !this.emeraldAvatars.has(mesh)) {
          mesh.userData.emeraldLoading = true;
          mesh.userData.emeraldReady = loadEmeraldAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.emeraldAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar emerald; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.emeraldLoading = false; });
        }
        if (isSapphire(e) && !mesh.userData.sapphireLoading && !this.sapphireAvatars.has(mesh)) {
          mesh.userData.sapphireLoading = true;
          mesh.userData.sapphireReady = loadSapphireAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.sapphireAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar sapphire; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.sapphireLoading = false; });
        }
        if (isRuby(e) && !mesh.userData.sapphireLoading && !mesh.userData.rubyLoading && !this.rubyAvatars.has(mesh)) {
          mesh.userData.rubyLoading = true;
          mesh.userData.rubyReady = loadRubyAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.rubyAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
            mesh.rotation.z = 0; mesh.position.set(e.x, e.y, e.z);
          }).catch(error => { console.warn('No se pudo cargar ruby; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.rubyLoading = false; });
        }
        if (isDust(e) && !mesh.userData.dustLoading && !this.dustAvatars.has(mesh)) {
          mesh.userData.dustLoading = true;
          mesh.userData.dustReady = loadDustAvatar(mesh).then(avatar => {
            if (this.disposed) { avatar.dispose(); return; }
            this.dustAvatars.set(mesh, avatar);
            softenEnemyMaterials(avatar.root);
            for (const child of mesh.children) if (child !== avatar.root) child.visible = false;
          }).catch(error => { console.warn('No se pudo cargar dust; se mantiene el modelo de respaldo.', error); })
            .finally(() => { mesh.userData.dustLoading = false; });
        }
      }
      // Fallback geometry is for a failed download, never a loading placeholder.
      // Hide children rather than the parent: flashing/death/pooling control it.
      if (!this.animatedAvatar(mesh)) {
        const ready = Object.entries(mesh.userData).filter(([key]) => key.endsWith('Ready')).map(([, value]) => value);
        if (ready.length && mesh.userData.fallbackPending !== ready[0]) {
          mesh.userData.fallbackPending = ready[0];
          const fallback = mesh.children.map(child => [child, child.visible]);
          for (const [child] of fallback) child.visible = false;
          Promise.allSettled(ready).then(() => {
            if (!this.disposed && !this.animatedAvatar(mesh)) for (const [child, visible] of fallback) child.visible = visible;
          });
        }
      }
      this.enemyData.set(e.id, e);
      mesh.position.set(e.x, e.y, e.z); mesh.rotation.y = e.yaw;
      const avatar = this.animatedAvatar(mesh);
      if (avatar) { mesh.rotation.z = 0; avatar.update(e, run.time, run.world); }
      else {
        if (e.type !== 'drone') { mesh.position.y += Math.sin(run.time * e.speed * 2 + e.id) * 0.045; mesh.rotation.z = Math.sin(run.time * e.speed + e.id) * 0.025; }
        if (e.type === 'titan') animateGuardian(mesh, e, run.time);
      }
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
  animatedAvatar(mesh) { return this.amethystAvatars.get(mesh) || this.emeraldAvatars.get(mesh) || this.sapphireAvatars.get(mesh) || this.rubyAvatars.get(mesh) || this.elteAvatars.get(mesh) || this.droneAvatars.get(mesh) || this.spitterAvatars.get(mesh) || this.bruteAvatars.get(mesh) || this.stalkerAvatars.get(mesh) || this.dustAvatars.get(mesh); }
  dispose() {
    for (const view of this.remotePlayers.values()) { view.avatar?.dispose(); this.scene.remove(view.mesh); } this.remotePlayers.clear();
    this.disposed = true; this.avatar?.dispose();
    for (const avatar of this.amethystAvatars.values()) avatar.dispose();
    for (const avatar of this.emeraldAvatars.values()) avatar.dispose();
    for (const avatar of this.sapphireAvatars.values()) avatar.dispose();
    for (const avatar of this.rubyAvatars.values()) avatar.dispose();
    for (const avatar of this.dustAvatars.values()) avatar.dispose();
    for (const avatar of this.stalkerAvatars.values()) avatar.dispose();
    for (const avatar of this.bruteAvatars.values()) avatar.dispose();
    for (const avatar of this.spitterAvatars.values()) avatar.dispose();
    for (const avatar of this.droneAvatars.values()) avatar.dispose();
    for (const avatar of this.elteAvatars.values()) avatar.dispose();
    for (const mesh of this.corpses.keys()) this.scene.remove(mesh);
    this.amethystAvatars.clear(); this.emeraldAvatars.clear(); this.sapphireAvatars.clear(); this.rubyAvatars.clear(); this.dustAvatars.clear(); this.stalkerAvatars.clear(); this.bruteAvatars.clear(); this.elteAvatars.clear(); this.spitterAvatars.clear(); this.droneAvatars.clear(); this.corpses.clear(); this.enemyData.clear();
    this.scene.remove(this.player, this.projectiles); this.projectiles.dispose(); this.projectileMaterial.dispose();
    for (const mesh of this.enemies.values()) this.scene.remove(mesh);
    for (const meshes of this.free.values()) for (const mesh of meshes) this.scene.remove(mesh);
    for (const mesh of this.gems.values()) this.scene.remove(mesh);
    this.gems.clear();
    this.enemies.clear(); this.free.clear();
  }
}
