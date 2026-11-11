import { Box3, Group, Vector3 } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';

export async function loadHelmet(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/helmet.glb');
  const bounds = new Box3().setFromObject(asset.scene);
  const size = bounds.getSize(new Vector3());
  asset.scene.position.sub(bounds.getCenter(new Vector3()));
  const pose = new Group();
  pose.scale.setScalar(.85 / Math.max(size.x, size.y, size.z));
  pose.rotation.z = 1.05;
  pose.add(asset.scene);
  const root = new Group(); root.name = 'cinematic-helmet'; root.add(pose);
  const posedBounds = new Box3().setFromObject(root);
  pose.position.y -= posedBounds.min.y;
  root.updateMatrixWorld(true);
  const contactPoints = [];
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true;
    const vertices = node.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      contactPoints.push(new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(node.matrixWorld));
    }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material.roughness !== undefined) material.roughness = Math.max(.65, material.roughness);
    }
  });
  const localCenter = new Box3().setFromObject(root).getCenter(new Vector3());
  const radius = posedBounds.getSize(new Vector3()).length() / 2;
  parent.add(root);
  let lastX, lastZ;
  return {
    root, radius, center: new Vector3(),
    place(x, z, heightAt) {
      if (x !== lastX || z !== lastZ) {
        // Seat the tilted mesh against the actual terrain, including its antennae.
        let y = -Infinity;
        for (const point of contactPoints) y = Math.max(y, heightAt(x + point.x, z + point.z) - point.y);
        root.position.set(x, y + .01, z); lastX = x; lastZ = z;
      }
      this.center.copy(localCenter).add(root.position);
    },
    dispose() { asset.dispose(); root.removeFromParent(); },
  };
}

export function frameHelmet(camera, center, radius, time) {
  const vertical = camera.fov * Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.35;
  const angle = .6 + Math.max(0, Math.min(10, time - 5)) * .015;
  camera.position.copy(center).add(new Vector3(Math.sin(angle), .5, Math.cos(angle)).normalize().multiplyScalar(distance));
  camera.lookAt(center);
}
