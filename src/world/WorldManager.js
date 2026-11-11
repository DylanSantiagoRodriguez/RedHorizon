import { loadEnvironment } from './EnvironmentAssets.js';
import { loadBurningWreck } from '../graphics/BurningWreck.js';
import * as THREE from 'three';
import { WorldModel } from './WorldModel.js';
import { Random } from '../utils/Random.js';
export class WorldManager {
  constructor(scene, models, seed) {
    this.scene = scene; this.models = models; this.seed = seed; this.group = new THREE.Group(); scene.add(this.group);
    this.model = new WorldModel(seed); this.terrain = this.model.terrain; this.random = new Random(`${seed}-decoration`);
    this.rockViews = []; this.obstacles = this.model.obstacles; this.cameraColliders = []; this.owned = []; this.beacons = []; this.rewards = [];
    this.buildTerrain(); this.buildRocks(); this.buildHorizon(); this.buildSites(); this.buildDetails(); this.batchStatic();
    this.plushies = this.model.plushies.map(p => ({ ...p }));
    this.environmentReady = loadEnvironment(this);
    this.group.updateMatrixWorld(true);
  }
  heightAt(x, z) { return this.terrain.heightAt(x, z); }
  buildTerrain() {
    const geo = new THREE.PlaneGeometry(240, 240, 120, 120); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.terrain.heightAt(x, z); pos.setY(i, h);
      color.setHSL(0.027 + h * 0.002, 0.57, 0.23 + h * 0.012 + this.random.range(-0.018, 0.018)); color.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat); this.terrainMesh=mesh; mesh.receiveShadow = true; this.group.add(mesh); this.owned.push(geo, mat);
  }
  buildRocks() {
    for (const rock of this.terrain.rocks) {
      const mesh = this.models.part(this.group, 'rock', this.random.pick([0x5b3b32, 0x6f4435, 0x814c37]), [rock.x, this.heightAt(rock.x, rock.z) + rock.height * 0.34, rock.z], [rock.radius, rock.height * 0.65, rock.radius]);
      this.rockViews.push(mesh); mesh.rotation.y = rock.rotation; this.cameraColliders.push(mesh);
    }
  }
  buildHorizon() {
    for (let i = 0; i < 55; i++) {
      const a = i / 55 * Math.PI * 2, d = this.random.range(140, 190), height = this.random.range(14, 47);
      const mesh = this.models.part(this.group, 'rock', this.random.pick([0x704132, 0x884b36, 0x603c35]), [Math.cos(a) * d, height * 0.15 - 2, Math.sin(a) * d], [this.random.range(15, 29), height, this.random.range(13, 25)]);
      mesh.rotation.y = a;
    }
    const sun = this.models.part(this.group, 'sphere', 0xffe4b1, [-95, 85, -165], [11, 11, 11], true); sun.castShadow = false;
    // Boundary is a visible hazard perimeter, not an invisible map edge.
    const points = [];
    for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2, x = Math.cos(a) * 109, z = Math.sin(a) * 109; points.push(new THREE.Vector3(x, this.heightAt(x, z) + 0.3, z)); }
    const geo = new THREE.BufferGeometry().setFromPoints(points), mat = new THREE.LineBasicMaterial({ color: 0xff8050, transparent: true, opacity: 0.7 });
    this.group.add(new THREE.Line(geo, mat)); this.owned.push(geo, mat);
  }
  solid(type, color, x, y, z, sx, sy, sz, _radius) {
    const mesh = this.models.part(this.group, type, color, [x, y, z], [sx, sy, sz]);
    this.cameraColliders.push(mesh); return mesh;
  }
  buildSites() {
    for (const site of this.terrain.pois) {
      const { x, z, type } = site, h = this.heightAt(x, z);
      if (type === 'relay') {
        this.solid('box', 0x354548, x - 5, h + 2.1, z, 5, 4.2, 6, 3.9);
        this.models.part(this.group, 'box', 0xaaa48b, [x - 5, h + 4.3, z], [5.4, 0.4, 6.4]);
        this.models.part(this.group, 'box', 0x79e6db, [x - 5, h + 2.6, z + 3.03], [3.8, 0.45, 0.05], true);
        this.solid('cylinder', 0x34464b, x + 3, h + 5, z - 3, 0.25, 10, 0.25, 0.6);
        const dish = this.models.part(this.group, 'sphere', 0xaeb5ad, [x + 3, h + 10, z - 3], [2.5, 0.3, 2.5]); dish.rotation.x = 0.5;
      } else if (type === 'ruin') {
        for (const side of [-1, 1]) {
          const pillar = this.solid('box', 0x514856, x + side * 4, h + 4, z - 3, 1.6, 8, 2.2, 1.4); pillar.rotation.z = side * 0.1;
          this.models.part(this.group, 'box', 0x9b83ff, [x + side * 4, h + 4.5, z - 1.85], [0.16, 4, 0.06], true);
        }
        this.models.part(this.group, 'box', 0x514856, [x, h + 8.2, z - 3], [10, 1.5, 2.6]);
      } else {
        this.wreckFallback = new THREE.Group(); this.group.add(this.wreckFallback);
        const hull = this.models.part(this.wreckFallback, 'cylinder', 0x899a95, [x + 4, h + 1.5, z - 4], [2.2, 7, 2.2]); hull.rotation.z = 1.15;
        const wing = this.models.part(this.wreckFallback, 'box', 0x3a4c4c, [x - 4, h + .6, z - 4], [5, .5, 3]); wing.rotation.z = -.15;
        this.models.part(this.wreckFallback, 'cone', 0xcf6b3f, [x + 7, h + 1.5, z - 4], [2, 4, 2]).rotation.z = -Math.PI / 2;
        this.cameraColliders.push(hull, wing);
        // A chain follows the long hull while leaving the site interaction beacon accessible.
        this.wreckReady = loadBurningWreck(this.group, site, (px, pz) => this.heightAt(px, pz), this.seed).then(wreck => {
          if (this.disposed) { wreck.dispose(); return; }
          this.wreck = wreck; this.wreckFallback.visible = false;
          this.cameraColliders = this.cameraColliders.filter(mesh => mesh !== hull && mesh !== wing);
          wreck.root.traverse(mesh => { if (mesh.isMesh) this.cameraColliders.push(mesh); });
          wreck.update(this.time || 0);
        }).catch(error => console.warn('No se pudo cargar la nave estrellada; se mantiene el respaldo.', error));
      }
      const beacon = new THREE.Group(); beacon.position.set(x, h, z + 3); this.group.add(beacon);
      this.models.part(beacon, 'cylinder', 0x263d40, [0, 0.35, 0], [0.8, 0.7, 0.8]);
      const crystal = this.models.part(beacon, 'rock', 0x78e9db, [0, 1.3, 0], [0.3, 0.65, 0.3], true);
      this.beacons.push({ ...this.model.beacons[this.beacons.length], mesh: beacon, crystal, used: false });
    }
    const pad = this.models.part(this.group, 'cylinder', 0x394344, [0, -0.05, 0], [3, 0.18, 3]); pad.receiveShadow = true;
    for (const reward of this.model.rewards) {
      const { x, z } = reward;
      const mesh = this.models.part(this.group, 'box', 0x788f7b, [x, this.heightAt(x, z) + 0.5, z], [1.1, 0.8, 0.8]);
      this.models.part(mesh, 'box', 0xb5ff9c, [0, 0.3, 0.53], [0.6, 0.12, 0.05], true);
      this.rewards.push({ ...reward, mesh });
    }
  }
  buildDetails() {
    const count = 450, mesh = new THREE.InstancedMesh(this.models.geometry('rock'), this.models.material(0x98593d), count), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = this.random.range(-100, 100), z = this.random.range(-100, 100);
      dummy.position.set(x, this.heightAt(x, z), z); dummy.scale.set(this.random.range(0.1, 0.5), this.random.range(0.1, 0.35), this.random.range(0.2, 0.5)); dummy.rotation.y = this.random.range(0, 6); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.receiveShadow = true; this.group.add(mesh);
    for (let i = 0; i < 24; i++) {
      const x = this.random.range(-80, 80), z = this.random.range(-80, 80);
      for (let j = 0; j < 3; j++) {
        const c = this.models.part(this.group, 'cone', i % 3 ? 0x5c8f88 : 0x8970bb, [x + j * 0.3, this.heightAt(x, z) + 0.45, z], [0.2, this.random.range(0.7, 1.8), 0.2]); c.rotation.z = (j - 1) * 0.3;
      }
    }
  }
  update(time) {
    this.time = time; this.wreck?.update(time);
    for(const p of this.plushies || []) if(p.mesh)p.mesh.visible=!p.used;
    for (const b of this.beacons) { b.crystal.rotation.y = time; b.crystal.position.y = 1.3 + Math.sin(time * 2) * 0.12; b.crystal.visible = !b.used; }
    for (const box of this.rewards) box.mesh.visible = !box.used;
  }
  batchStatic() {
    const batches = new Map(), dynamic = new Set(this.rewards.map(r => r.mesh));
    for (const mesh of [...this.group.children]) {
      if (!mesh.isMesh || mesh.isInstancedMesh || dynamic.has(mesh) || this.rockViews.includes(mesh) || mesh.children.length) continue;
      const key = `${mesh.geometry.uuid}:${mesh.material.uuid}:${mesh.castShadow}`;
      if (!batches.has(key)) batches.set(key, []); batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 3) continue;
      const source = meshes[0], instances = new THREE.InstancedMesh(source.geometry, source.material, meshes.length);
      instances.castShadow = source.castShadow; instances.receiveShadow = source.receiveShadow;
      meshes.forEach((mesh, i) => { mesh.updateMatrix(); instances.setMatrixAt(i, mesh.matrix); mesh.visible = false; });
      instances.computeBoundingSphere(); this.group.add(instances);
    }
  }
  dispose() { this.disposed=true; this.wreck?.dispose(); this.disposeEnvironment?.(); this.scene.remove(this.group); this.group.traverse(node => { if (node.isInstancedMesh) node.dispose(); }); this.owned.forEach(r => r.dispose()); }
}
