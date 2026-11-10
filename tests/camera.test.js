import { it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../src/graphics/CameraController.js';
import { Run } from '../src/core/Run.js';

it.each([false, true])('permite apuntar y disparar al cielo incluso junto al suelo (zoom %s)', zoom => {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.15, 420);
  const controller = new CameraController(camera);
  const world = { heightAt: () => 0, obstacles: [], cameraColliders: [] };
  const run = new Run(world, 'sky');
  controller.update(1 / 60, { dx: 0, dy: -2000, buttons: new Set(zoom ? [2] : []) }, run.player, world);
  camera.updateMatrixWorld(true);
  expect(controller.pitch).toBe(-1.48);
  expect(camera.position.y).toBeGreaterThanOrEqual(0.5);
  expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeGreaterThan(0.99);
  const aim = controller.shotDirection(run);
  expect(aim.y).toBeGreaterThan(0.98);
  run.weapon.fire(run, aim);
  expect(run.combat.pool.items.find(p => p.active).vy).toBeGreaterThan(0);
});
it('limita la inclinación hacia el suelo sin invertir la cámara', () => {
  const camera = new THREE.PerspectiveCamera(), controller = new CameraController(camera);
  controller.update(1 / 60, { dx: 0, dy: 10000, buttons: new Set() }, { x: 0, y: 0, z: 0 }, { heightAt: () => 0 });
  camera.updateMatrixWorld(true);
  expect(controller.pitch).toBe(1.48);
  expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeLessThan(-0.99);
});
