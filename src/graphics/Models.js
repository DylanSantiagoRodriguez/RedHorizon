import { softenEnemyMaterials } from './EnemyAppearance.js';
import * as THREE from 'three';
import { enemyModelKey } from '../data/guardians.js';
import { buildEnemyArmor, addGuardianEffects } from './EnemyModels.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Shared geometries/materials live for the application, all disposed at shutdown.
export class Models {
  constructor() { this.geometries = new Map(); this.materials = new Map(); this.enemyTemplates = new Map(); }
  material(color, glow = false) {
    const key = `${color}:${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: glow ? 0.35 : 0.2, flatShading: true, emissive: glow ? color : 0, emissiveIntensity: glow ? 2 : 0 }));
    return this.materials.get(key);
  }
  geometry(type) {
    if (!this.geometries.has(type)) {
      const geo = type === 'torus' ? new THREE.TorusGeometry(1, 0.13, 6, 16) : type === 'rock' ? new THREE.IcosahedronGeometry(1, 1) : type === 'sphere' ? new THREE.SphereGeometry(1, 12, 8) : type === 'cone' ? new THREE.ConeGeometry(1, 1, 6) : type === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 8) : new THREE.BoxGeometry(1, 1, 1);
      this.geometries.set(type, geo);
    }
    return this.geometries.get(type);
  }
  part(parent, type, color, pos, scale, glow = false) {
    const mesh = new THREE.Mesh(this.geometry(type), this.material(color, glow));
    mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow = !glow; mesh.receiveShadow = !glow; parent.add(mesh); return mesh;
  }
  player() {
    const g = new THREE.Group(), white = 0xd7d6bf, dark = 0x26393b, orange = 0xdb623a;
    this.part(g, 'box', white, [0, 1.3, 0], [0.68, 0.8, 0.44]);
    this.part(g, 'box', dark, [0, 1.45, 0.245], [0.47, 0.38, 0.08]);
    this.part(g, 'box', 0x8df3eb, [0, 1.5, 0.3], [0.29, 0.05, 0.03], true);
    this.part(g, 'sphere', white, [0, 1.99, 0], [0.37, 0.37, 0.32]);
    this.part(g, 'box', 0x183e49, [0, 2.02, 0.28], [0.5, 0.22, 0.12]);
    this.part(g, 'box', 0x7fe5dd, [0, 2.06, 0.35], [0.35, 0.035, 0.015], true);
    this.part(g, 'box', dark, [0, 1.3, -0.34], [0.58, 0.66, 0.28]);
    for (const x of [-0.3, 0.3]) this.part(g, 'cylinder', orange, [x, 1.25, -0.38], [0.13, 0.65, 0.13]);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.2, 0.95, 0); g.add(leg);
      this.part(leg, 'box', dark, [0, -0.34, 0], [0.24, 0.62, 0.27]);
      this.part(leg, 'box', white, [0, -0.29, 0.13], [0.26, 0.25, 0.1]);
      this.part(leg, 'box', dark, [0, -0.79, 0.06], [0.29, 0.22, 0.43]); legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.48, 1.6, 0); g.add(arm);
      this.part(arm, 'box', orange, [0, -0.02, 0], [0.3, 0.27, 0.35]);
      this.part(arm, 'box', white, [0, -0.32, 0.05], [0.23, 0.44, 0.25]); arms.push(arm);
    }
    const gun = new THREE.Group(); gun.position.set(0.48, 1.21, 0.3); g.add(gun);
    g.userData = { legs, arms, gun }; return g;
  }
  animatePlayer(mesh, player) {
    mesh.position.set(player.x, player.y, player.z); mesh.rotation.y = player.yaw;
    const gait = Math.min(1, Math.hypot(player.vx, player.vz) / 5);
    mesh.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(player.steps * 1.4 + i * Math.PI) * 0.65 * gait; });
    mesh.userData.arms.forEach((arm, i) => { arm.rotation.x = -0.3 + Math.sin(player.steps * 1.4 + i * Math.PI) * 0.2 * gait; });
    mesh.visible = !player.dead;
  }
  enemy(data) {
    const key = enemyModelKey(data);
    if (!this.enemyTemplates.has(key)) {
      const compact = this.compactEnemy(buildEnemyArmor(this, data), key);
      if (data.type === 'titan') addGuardianEffects(this, compact, data);
      this.enemyTemplates.set(key, compact);
    }
    return this.enemyTemplates.get(key).clone();
  }
  compactEnemy(group, type) {
    // Profiling found >1000 calls with a full horde. Bake static anatomy into
    // two shared buffers per type; body gait remains procedural in EntityViews.
    group.updateMatrixWorld(true); const batches = [[], []];
    group.traverse(node => {
      if (!node.isMesh) return;
      const geo = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone(); geo.applyMatrix4(node.matrixWorld);
      const color = node.material.color, colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); batches[node.material.emissiveIntensity > 0 ? 1 : 0].push(geo);
    });
    const compact = new THREE.Group();
    for (let i = 0; i < batches.length; i++) {
      if (!batches[i].length) continue;
      const geometry = mergeGeometries(batches[i]); batches[i].forEach(g => g.dispose()); this.geometries.set(`enemy-${type}-${i}`, geometry);
      const key = `enemy-batch-${i}`;
      if (!this.materials.has(key)) this.materials.set(key, i ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.65, flatShading: true }));
      const mesh = new THREE.Mesh(geometry, this.materials.get(key)); mesh.castShadow = !i; mesh.receiveShadow = !i; compact.add(mesh);
    }
    softenEnemyMaterials(compact);
    return compact;
  }
  dispose() { this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
