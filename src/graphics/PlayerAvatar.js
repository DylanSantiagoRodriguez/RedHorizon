import * as THREE from 'three';
import { loadAnimatedModel } from './AssetLoader.js';

export async function loadPlayerAvatar(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/player.glb');
  const root = new THREE.Group(), body = asset.scene;
  root.add(body); body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body), size = bounds.getSize(new THREE.Vector3());
  const scale = 2.2 / size.y;
  body.scale.multiplyScalar(scale);
  body.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
  const bones = new Map();
  body.traverse(node => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    if (node.isBone) bones.set(node.name, { node, rest: node.quaternion.clone() });
  });
  parent.add(root);
  const axisX = new THREE.Vector3(1, 0, 0), axisZ = new THREE.Vector3(0, 0, 1), rotation = new THREE.Quaternion();
  const pose = (name, angle, axis = axisX) => {
    const bone = bones.get(name) || bones.get(name.replace('.', ''));
    if (bone) bone.node.quaternion.copy(bone.rest).multiply(rotation.setFromAxisAngle(axis, angle));
  };
  return {
    root,
    update(player, time) {
      const speed = Math.hypot(player.vx, player.vz), stride = Math.min(1, speed / 7);
      const forward = player.vx * Math.sin(player.yaw) + player.vz * Math.cos(player.yaw);
      const cycle = Math.sin(player.steps * 1.4) * (forward < 0 ? -1 : 1) * stride;
      const slide = player.slideTime > 0;
      for (const { node, rest } of bones.values()) node.quaternion.copy(rest);
      pose('Arm.L', -1.15, axisZ); pose('Arm.R', 1.15, axisZ);
      pose('Forearm.L', -0.35); pose('Forearm.R', -0.6);
      pose('Thigh.L', slide ? -1.1 : !player.grounded ? -0.5 : cycle * 0.6);
      pose('Thigh.R', slide ? -0.7 : !player.grounded ? 0.2 : -cycle * 0.6);
      pose('Leg.L', slide ? 1.4 : Math.max(0, -cycle) * 0.7);
      pose('Leg.R', slide ? 1.2 : Math.max(0, cycle) * 0.7);
      pose('Column2', slide ? 0.45 : Math.sin(time * 2) * 0.015);
      root.position.y = slide ? -0.55 : 0;
    },
    dispose() { asset.dispose(); root.removeFromParent(); },
  };
}
