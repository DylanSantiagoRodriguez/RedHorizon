import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ObjectPool } from '../utils/ObjectPool.js';
import { Random } from '../utils/Random.js';
export class ParticleSystem {
  constructor(scene, models) {
    this.scene = scene; this.pool = new ObjectPool(CONFIG.particleLimit, () => ({})); this.random = new Random('fx');
    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.mesh = new THREE.InstancedMesh(models.geometry('rock'), this.material, CONFIG.particleLimit); this.mesh.frustumCulled = false; scene.add(this.mesh); this.mesh.count = 0;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.ringGeometry = new THREE.RingGeometry(0.93, 1, 64); this.rings = [];
    for (let i = 0; i < 16; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xff7553, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(this.ringGeometry, material); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); this.rings.push(ring);
    }
    this.dustGeometry = new THREE.BufferGeometry(); this.dust = new Float32Array(210 * 3);
    for (let i = 0; i < this.dust.length; i += 3) { this.dust[i] = this.random.range(-60, 60); this.dust[i + 1] = this.random.range(0.5, 12); this.dust[i + 2] = this.random.range(-60, 60); }
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dust, 3));
    this.dustMaterial = new THREE.PointsMaterial({ color: 0xe9b88a, size: 0.085, transparent: true, opacity: 0.45, depthWrite: false });
    this.dustMesh = new THREE.Points(this.dustGeometry, this.dustMaterial); this.dustMesh.frustumCulled = false; scene.add(this.dustMesh);
  }
  burst(data, count = 10, color = data.color || 0xffbd76, speed = 5) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire(); if (!p) break;
      Object.assign(p, { x: data.x, y: data.y, z: data.z, vx: this.random.range(-speed, speed), vy: this.random.range(1, speed), vz: this.random.range(-speed, speed), life: this.random.range(0.2, 0.65), size: this.random.range(0.04, 0.16), gravity: 10, color });
    }
  }
  shot(data) {
    const scatter = data.kind === 'scatter', nova = data.kind === 'nova';
    const count = scatter ? 16 : nova ? 18 : 7, spread = scatter ? 3.5 : 1.1;
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire(); if (!p) break;
      const steam = nova && i % 2 === 0, speed = steam ? 0.5 : this.random.range(3, 8);
      Object.assign(p, { x: data.x, y: data.y, z: data.z,
        vx: data.direction.x * speed + this.random.range(-spread, spread),
        vy: data.direction.y * speed + this.random.range(-spread, spread),
        vz: data.direction.z * speed + this.random.range(-spread, spread),
        life: steam ? 0.55 : this.random.range(0.12, 0.3), size: steam ? 0.13 : 0.035,
        color: steam ? 0x9aacae : data.color, gravity: steam ? -2 : 3 });
    }
  }
  reset() { this.pool.clear(); for (const ring of this.rings) ring.visible = false; }
  update(dt, run) {
    let count = 0;
    for (const p of this.pool.items) {
      if (!p.active) continue; p.life -= dt; if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * p.gravity;
      this.dummy.position.set(p.x, p.y, p.z); this.dummy.scale.setScalar(p.size * Math.min(1, p.life * 4)); this.dummy.rotation.x += dt; this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix); this.mesh.setColorAt(count, this.color.setHex(p.color)); count++;
    }
    this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.rings.length; i++) {
      const zone = run.boss.zones[i], ring = this.rings[i]; ring.visible = !!zone;
      if (zone) { ring.position.set(zone.x, zone.y + 0.14, zone.z); ring.scale.setScalar(zone.radius); ring.material.opacity = 0.4 + (1 - zone.remaining / zone.duration) * 0.6; }
    }
    const storm = Math.sin(run.time / 35) > 0.8;
    for (let i = 0; i < this.dust.length; i += 3) { this.dust[i] += dt * (storm ? 15 : 4); if (this.dust[i] > 60) this.dust[i] = -60; }
    this.dustMesh.position.set(run.player.x, run.player.y, run.player.z); this.dustGeometry.attributes.position.needsUpdate = true;
    this.dustMaterial.opacity = storm ? 0.65 : 0.28;
  }
  dispose() {
    this.scene.remove(this.mesh, this.dustMesh); this.mesh.dispose(); this.material.dispose(); this.dustGeometry.dispose(); this.dustMaterial.dispose();
    for (const ring of this.rings) { this.scene.remove(ring); ring.material.dispose(); } this.ringGeometry.dispose();
  }
}
