import * as THREE from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
import { CONFIG } from '../config.js';
import { LOCOMOTION, movementWeights, avatarState } from './PlayerAnimationState.js';
const UPPER = /(?:Spine|Neck|Head|Shoulder|Arm|ForeArm|Hand)/;

export async function loadPlayerAvatar(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/player/player.glb');
  const root = new THREE.Group(), body = asset.scene;
  root.name = 'animated-player'; root.add(body);
  const bones = new Map();
  body.traverse(node => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    if (node.isBone) bones.set(node.name.replace(/^mixamorig:?/, ''), node);
  });
  // These FBXs carry a scaled armature; measure a sampled clip, not inverse-bind rest poses.
  asset.actions.idle_rifle?.play(); asset.mixer.update(0);
  body.updateMatrixWorld(true);
  body.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(body, true), size = bounds.getSize(new THREE.Vector3());
  const scale = 2.2 / size.y;
  body.scale.multiplyScalar(scale);
  body.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
  root.updateMatrixWorld(true);
  const hips = bones.get('Hips');
  if (!hips) { asset.dispose(); throw new Error('El personaje necesita el hueso Hips.'); }
  const hipMatrix = hips.parent.matrixWorld.clone(), hipInverse = hipMatrix.clone().invert();
  const clips = new Map(), point = new THREE.Vector3();
  const idleTrack = asset.clips.find(c => c.name === 'idle_rifle')?.tracks.find(t => t.name === hips.name + '.position');
  if (!idleTrack) { asset.dispose(); throw new Error('El personaje necesita el clip idle_rifle.'); }
  const anchor = new THREE.Vector3().fromArray(idleTrack.values).applyMatrix4(hipMatrix);
  for (const source of asset.clips) {
    const clip = source.clone();
    for (const track of clip.tracks) {
      if (track.name !== hips.name + '.position') continue;
      for (let i = 0; i < track.values.length; i += 3) {
        point.fromArray(track.values, i).applyMatrix4(hipMatrix);
        point.x = anchor.x; point.z = anchor.z;
        // Physical altitude belongs to the game, not to Mixamo root motion.
        if (clip.name === 'jump') point.y = anchor.y;
        point.applyMatrix4(hipInverse).toArray(track.values, i);
      }
    }
    clips.set(clip.name, clip);
  }
  asset.mixer.stopAllAction();
  const actions = new Map();
  for (const name of [...LOCOMOTION, 'jump', 'slide', 'death', 'final_exhausted', 'final_collapse']) {
    const clip = clips.get(name); if (!clip) continue;
    const action = asset.mixer.clipAction(clip);
    action.setEffectiveWeight(name === 'idle_rifle' ? 1 : 0).play();
    if (['death', 'final_collapse'].includes(name)) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.paused = true; }
    actions.set(name, action);
  }
  const overlays = new Map();
  for (const name of ['fire', 'hit_react', 'interact', 'weapon_lower', 'weapon_raise']) {
    const source = clips.get(name); if (!source) continue;
    const clip = source.clone(); clip.name = 'upper_' + name;
    clip.tracks = clip.tracks.filter(t => UPPER.test(t.name) && t.name.endsWith('.quaternion'));
    THREE.AnimationUtils.makeClipAdditive(clip, 0, clips.get('idle_rifle'), 30);
    const action = asset.mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
    overlays.set(name, { action, elapsed: Infinity, duration: 0, weight: 1 });
  }
  const trigger = (name, duration, weight = 1) => {
    const item = overlays.get(name); if (!item) return;
    item.elapsed = 0; item.duration = duration; item.weight = weight;
    item.action.reset().setEffectiveTimeScale(item.action.getClip().duration / duration).setEffectiveWeight(0).play();
  };
  parent.add(root);
  asset.mixer.update(0); root.updateWorldMatrix(true, true);
  const axis = new THREE.Vector3(), worldQ = new THREE.Quaternion(), tilt = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion(), handQ = new THREE.Quaternion(), aimRestore = [];
  parent.getWorldQuaternion(parentQ).invert(); bones.get('RightHand').getWorldQuaternion(handQ);
  const handRotationOffset = handQ.premultiply(parentQ).invert().clone();
  const hand = new THREE.Vector3(), gripOffset = new THREE.Vector3(0, -0.21, 0);
  const jointPosition = new THREE.Vector3(), endDirection = new THREE.Vector3(), targetDirection = new THREE.Vector3();
  const supportTarget = new THREE.Vector3(), swing = new THREE.Quaternion(), jointParent = new THREE.Quaternion();
  const supportArm = bones.get('LeftArm'), supportForearm = bones.get('LeftForeArm'), supportHand = bones.get('LeftHand');
  const aimJoint = joint => {
    joint.updateWorldMatrix(true, true); joint.getWorldPosition(jointPosition);
    supportHand.getWorldPosition(endDirection).sub(jointPosition).normalize();
    targetDirection.copy(supportTarget).sub(jointPosition).normalize();
    swing.setFromUnitVectors(endDirection, targetDirection);
    joint.parent.getWorldQuaternion(jointParent);
    swing.premultiply(jointParent.clone().invert()).multiply(jointParent);
    joint.quaternion.premultiply(swing);
  };
  let state = 'locomotion', phase = 0, shot = 0, hit = 0, interaction = 0, equipped = null, switchTime = -1;
  const avatar = {
    root, actions, clips, bones, overlays, state, ready: true,
    update(run, dt) {
      for (const [bone, quaternion] of aimRestore) bone.quaternion.copy(quaternion);
      aimRestore.length = 0;
      const p = run.player, next = avatarState(run), changed = next !== state;
      if (changed) {
        state = next;
        if (['death', 'final_collapse'].includes(state)) actions.get(state)?.reset().setLoop(THREE.LoopOnce, 1).play();
        if (state === 'slide' || state === 'jump') for (const item of overlays.values()) { item.elapsed = Infinity; item.action.stop(); }
      }
      avatar.state = state;
      const weights = state === 'locomotion' ? movementWeights(p) : { [state]: 1 };
      phase = (phase + Math.hypot(p.vx, p.vz) * dt / 4.8) % 1;
      for (const [name, action] of actions) {
        const target = weights[name] || 0, blend = 1 - Math.exp(-18 * dt);
        action.setEffectiveWeight(action.getEffectiveWeight() + (target - action.getEffectiveWeight()) * blend);
        if (LOCOMOTION.includes(name) && name !== 'idle_rifle') { action.time = phase * action.getClip().duration; action.paused = true; }
        if (name === 'jump') { action.paused = true; action.time = Math.min(0.9, Math.max(0, (CONFIG.jumpSpeed - p.vy) / (2 * CONFIG.jumpSpeed))) * action.getClip().duration; }
        if (name === 'slide') { action.paused = true; action.time = Math.max(0, 1 - p.slideTime / 0.8) * action.getClip().duration; }
      }
      const active = !p.dead && state !== 'final_collapse';
      if (run.weapon.shotId !== shot) { shot = run.weapon.shotId; if (active && state !== 'slide') trigger('fire', 0.16, 0.8); }
      if (p.hitSerial !== hit) { hit = p.hitSerial; if (active && state !== 'slide') trigger('hit_react', 0.25, 0.35); }
      if (p.interactSerial !== interaction) { interaction = p.interactSerial; if (active && state !== 'slide') trigger('interact', 0.8, 0.8); }
      if (equipped !== run.weapon.equipped) {
        if (equipped && active && state !== 'slide') { trigger('weapon_lower', 0.18, 0.65); switchTime = 0.18; }
        equipped = run.weapon.equipped;
      }
      if (switchTime >= 0) { switchTime -= dt; if (switchTime < 0 && active && state !== 'slide') trigger('weapon_raise', 0.22, 0.65); }
      for (const item of overlays.values()) {
        item.elapsed += dt;
        if (!active || state === 'slide' || item.elapsed >= item.duration) { item.action.stop(); continue; }
        item.action.setEffectiveWeight(item.weight * Math.min(1, item.elapsed / 0.035, (item.duration - item.elapsed) / 0.08));
      }
      asset.mixer.update(dt);
      // Share vertical aim across the spine without changing movement-facing yaw.
      if (active && state !== 'slide' && run.weapon.aim) {
        const pitch = -Math.asin(THREE.MathUtils.clamp(run.weapon.aim.y, -1, 1));
        for (const name of ['Spine', 'Spine1', 'Spine2']) {
          const bone = bones.get(name); if (!bone) continue;
          aimRestore.push([bone, bone.quaternion.clone()]);
          bone.parent.updateWorldMatrix(true, false); bone.parent.getWorldQuaternion(worldQ).invert();
          axis.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw)).applyQuaternion(worldQ).normalize();
          bone.quaternion.premultiply(tilt.setFromAxisAngle(axis, pitch / 3));
        }
      }
      root.updateWorldMatrix(true, true);
    },
    attachWeapon(mount, run) {
      const right = bones.get('RightHand'); if (!right) return;
      const handling = ['interact', 'weapon_lower', 'weapon_raise'].some(name => overlays.get(name)?.elapsed < overlays.get(name)?.duration);
      if (state === 'slide' || handling) {
        parent.getWorldQuaternion(parentQ).invert(); right.getWorldQuaternion(handQ);
        mount.quaternion.copy(handQ.premultiply(parentQ).multiply(handRotationOffset));
      }
      right.getWorldPosition(hand); parent.worldToLocal(hand);
      mount.position.copy(hand).sub(point.copy(gripOffset).applyQuaternion(mount.quaternion));
      mount.position.z -= run.weapon.recoil * 0.025;
      mount.visible = !run.player.dead && run.mission.phase !== 'cinematic';
      if (mount.visible && state !== 'slide' && !handling && supportArm && supportForearm && supportHand) {
        // Fit the support hand to the actual foregrip, rather than the placeholder rifle in Mixamo.
        aimRestore.push([supportArm, supportArm.quaternion.clone()], [supportForearm, supportForearm.quaternion.clone()]);
        mount.updateWorldMatrix(true, false); supportTarget.set(0, -0.09, 0.35).applyMatrix4(mount.matrixWorld);
        for (let i = 0; i < 4; i++) { aimJoint(supportForearm); aimJoint(supportArm); }
        root.updateWorldMatrix(true, true);
      }
    },
    dispose() { asset.dispose(); root.removeFromParent(); },
  };
  return avatar;
}
