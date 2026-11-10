import * as THREE from 'three';
import { CONFIG } from '../config.js';
export class CameraController {
  constructor(camera) {
    this.camera = camera; this.yaw = 0; this.pitch = 0.17; this.sensitivity = 1; this.distance = CONFIG.cameraDistance;
    this.target = new THREE.Vector3(); this.desired = new THREE.Vector3(); this.direction = new THREE.Vector3(); this.ray = new THREE.Raycaster(); this.ready = false;
  }
  update(dt, input, player, world) {
    this.yaw += input.dx * 0.0025 * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.dy * 0.002 * this.sensitivity, -1.48, 1.48);
    input.dx = 0; input.dy = 0;
    this.target.set(player.x + Math.cos(this.yaw) * 0.95, player.y + (player.slideTime > 0 ? 1.05 : 1.9), player.z + Math.sin(this.yaw) * 0.95);
    const distance = (input.down ? input.down('Mouse2') : input.buttons.has(2)) ? 3.4 : this.distance;
    this.direction.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.ray.set(this.target, this.direction); this.ray.far = distance;
    const hit = this.ray.intersectObjects(world.cameraColliders || [], false)[0];
    const safeDistance = hit ? Math.max(0.55, hit.distance - 0.35) : distance;
    this.desired.copy(this.target).addScaledVector(this.direction, safeDistance);
    this.desired.y = Math.max(this.desired.y, world.heightAt(this.desired.x, this.desired.z) + 0.5);
    const smoothing = this.ready ? 1 - Math.exp(-14 * dt) : 1;
    this.camera.position.lerp(this.desired, hit ? 1 : smoothing);
    // Terrain may lift the camera, but must not flatten the aiming angle.
    this.camera.lookAt(this.desired.copy(this.camera.position).addScaledVector(this.direction, -1)); this.ready = true;
  }
  aim() { return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  shotDirection(run, assist = false) {
    this.ray.setFromCamera({ x: 0, y: 0 }, this.camera); this.ray.far = 100;
    const hit = this.ray.intersectObjects(run.world.cameraColliders, false)[0];
    let distance = hit ? hit.distance : 85;
    const target = this.ray.ray.at(distance, new THREE.Vector3());
    const sphere = new THREE.Sphere(), point = new THREE.Vector3();
    for (const enemy of run.enemies) {
      if (enemy.dead) continue;
      sphere.center.set(enemy.x, enemy.y, enemy.z); sphere.radius = enemy.radius + (assist ? Math.min(1.7, distance * 0.025) : 0);
      if (this.ray.ray.intersectSphere(sphere, point)) {
        const d = point.distanceTo(this.camera.position);
        if (d < distance) { distance = d; target.set(enemy.x, enemy.y, enemy.z); }
      }
    }
    return target.sub(new THREE.Vector3(run.player.x, run.player.y + (run.player.slideTime > 0 ? 0.75 : 1.45), run.player.z)).normalize();
  }
}
