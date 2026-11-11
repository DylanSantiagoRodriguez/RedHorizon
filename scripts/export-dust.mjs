// Rebuild with node scripts/export-dust.mjs. Original FBX files remain untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DUST_CLIPS } from '../src/data/dustAnimations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'Modelos_Animados/dust');
await fs.mkdir(output, { recursive: true });
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const files = {
  idle: 'Idle.fbx', move: 'Walking.fbx', attack_melee: 'Standing Melee Attack Horizontal(attack_melee).fbx',
  attack_special: 'Standing 1H Magic Attack 01(attack_special).fbx', summon: 'Spell Casting(summon).fbx',
  stunned: 'Stunned.fbx', death: 'Standing React Death Backward.fbx',
};
async function readFBX(file) {
  const bytes = await fs.readFile(path.join(root, '3Dmodels/sand boss', file));
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const model = await readFBX(files.idle);
model.name = 'dust_rig'; model.updateMatrixWorld(true);
const bones = new Map(); model.traverse(n => { if (n.isBone) bones.set(n.name, n); });
const signatureOf = b => ({ name: b.name, parent: b.parent.isBone ? b.parent.name : '', matrix: b.matrix.toArray() });
const reference = [...bones.values()].map(signatureOf);
const referencePosition = bones.get('mixamorigHips').position.clone();
const bronze = new THREE.MeshStandardMaterial({ name: 'sand_bronze', color: 0x9b804e, metalness: 0.72, roughness: 0.47 });
const iron = new THREE.MeshStandardMaterial({ name: 'mechanism_iron', color: 0x293239, metalness: 0.8, roughness: 0.4 });
const gold = new THREE.MeshStandardMaterial({ name: 'machined_brass', color: 0xc89b45, metalness: 0.85, roughness: 0.32 });
const energy = new THREE.MeshStandardMaterial({ name: 'golden_core', color: 0xffd050, emissive: 0xffb820, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.3 });
model.traverse(n => {
  if (!n.isSkinnedMesh) return;
  n.name = 'dust_armor'; n.geometry = mergeVertices(n.geometry); n.normalizeSkinWeights(); n.material = bronze;
  const tips = [...bones.values()].filter(b => !n.skeleton.bones.includes(b));
  n.skeleton = new THREE.Skeleton([...n.skeleton.bones, ...tips], [...n.skeleton.boneInverses, ...tips.map(b => b.matrixWorld.clone().invert())]);
});
// Rigid mechanisms follow existing bones; their motion is sampled into every clip.
function attach(name, bone, worldPosition) {
  const object = new THREE.Group(); object.name = name;
  object.position.copy(bone.worldToLocal(new THREE.Vector3(...worldPosition)));
  object.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
  bone.add(object); return object;
}
function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position); parent.add(object); return object;
}
const core = attach('core_socket', bones.get('mixamorigSpine1'), [0, 0.7, 0.175]);
mesh(core, new THREE.TorusGeometry(0.075, 0.012, 8, 32), iron);
const coreEnergy = mesh(core, new THREE.SphereGeometry(0.059, 20, 12), energy);
coreEnergy.name = 'core_energy'; coreEnergy.scale.z = 0.3;
const coreRotor = mesh(core, new THREE.TorusGeometry(0.065, 0.004, 6, 24), gold, [0, 0, 0.017]); coreRotor.name = 'core_rotor';
for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; mesh(coreRotor, new THREE.BoxGeometry(0.018, 0.01, 0.009), gold, [Math.cos(a) * 0.063, Math.sin(a) * 0.063, 0]).rotation.z = a; }
const gear = attach('back_gear', bones.get('mixamorigSpine2'), [0, 0.77, -0.2]);
mesh(gear, new THREE.TorusGeometry(0.14, 0.018, 8, 32), iron);
for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; mesh(gear, new THREE.BoxGeometry(0.035, 0.025, 0.035), gold, [Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0]).rotation.z = a; }
for (let i = 0; i < 3; i++) mesh(gear, new THREE.BoxGeometry(0.27, 0.018, 0.018), iron).rotation.z = i * Math.PI / 3;
const drills = [];
for (const side of ['Left', 'Right']) {
  const hand = bones.get(`mixamorig${side}Hand`), pos = hand.getWorldPosition(new THREE.Vector3());
  const mount = attach(`drill_mount_${side.toLowerCase()}`, hand, [pos.x, pos.y - 0.035, pos.z + 0.035]);
  const drill = new THREE.Group(); drill.name = `drill_${side.toLowerCase()}`; mount.add(drill); drills.push(drill);
  mesh(drill, new THREE.CylinderGeometry(0.055, 0.055, 0.055, 16), iron).rotation.x = Math.PI / 2;
  mesh(drill, new THREE.ConeGeometry(0.055, 0.17, 16), gold, [0, 0, 0.1]).rotation.x = Math.PI / 2;
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 100 }, (_, i) => {
    const t = i / 99, a = t * Math.PI * 8, r = 0.054 * (1 - t);
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.018 + t * 0.166);
  }));
  mesh(drill, new THREE.TubeGeometry(curve, 100, 0.005, 5, false), iron);
}
const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle_socket'; muzzle.position.set(0, 0, 0.08); core.add(muzzle);
const clips = [], quat = new THREE.Quaternion(), yawCorrection = new THREE.Quaternion();
for (const [name, file] of Object.entries(files)) {
  const source = await readFBX(file), signature = [];
  source.updateMatrixWorld(true);
  source.traverse(b => { if (b.isBone) signature.push(signatureOf(b)); });
  assert.equal(signature.length, reference.length);
  for (let i = 0; i < reference.length; i++) {
    assert.equal(signature[i].name, reference[i].name); assert.equal(signature[i].parent, reference[i].parent);
    assert.ok(signature[i].matrix.every((v, j) => Math.abs(v - reference[i].matrix[j]) < 1e-6), `${file}: incompatible bind matrix for ${signature[i].name}`);
  }
  const original = source.animations[0], config = DUST_CLIPS[name], times = Array.from({ length: config.frames + 1 }, (_, i) => i / 30);
  const tracks = original.tracks.map(track => {
    const size = track.getValueSize(), values = [], interpolant = track.createInterpolant();
    for (let i = 0; i < times.length; i++) {
      const t = i / config.frames;
      // The supplied Stunned ends on the floor: loop only its initial jam gesture.
      let sourceTime = name === 'stunned' ? Math.sin(t * Math.PI) ** 2 * 0.22 : t * original.duration;
      if (name === 'death') sourceTime = Math.min(1, times[i] / (config.duration - 0.3)) * original.duration;
      const value = Array.from(interpolant.evaluate(sourceTime));
      if (track.name === 'mixamorigHips.position') { value[0] = referencePosition.x; value[2] = referencePosition.z; }
      if (track.name === 'mixamorigHips.quaternion') {
        quat.fromArray(value);
        // Remove the vertical twist without a heading flip when death tilts past 90 degrees.
        yawCorrection.set(0, quat.y, 0, quat.w).normalize().invert();
        quat.premultiply(yawCorrection).normalize().toArray(value);
      }
      values.push(...value);
    }
    if (config.loop) values.splice(values.length - size, size, ...values.slice(0, size));
    return new track.constructor(track.name, times, values);
  });
  for (const [object, turns] of [[gear, 1], [coreRotor, -1], ...drills.map(d => [d, name === 'attack_special' ? 7 : 2])]) {
    const values = [];
    for (let i = 0; i < times.length; i++) {
      const t = i / config.frames;
      const motion = name === 'stunned' ? Math.sin(t * Math.PI * 6) * 0.025 : name === 'death' ? Math.min(t / 0.75, 1) : t;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), motion * Math.PI * 2 * turns);
      if (object === gear) q.premultiply(gear.quaternion);
      values.push(...q.toArray());
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${object.name}.quaternion`, times, values));
  }
  tracks.push(new THREE.VectorKeyframeTrack('core_energy.scale', times, times.flatMap(t => {
    const glow = name === 'death' ? Math.max(0, 1 - Math.max(0, t / config.duration - 0.45) / 0.3) : 1;
    return [glow, glow, glow * 0.3];
  })));
  const clip = new THREE.AnimationClip(name, config.duration, tracks);
  // Retargeted death penetrates the ground. Bake a vertical pelvis correction into
  // each sample, including the rigid mechanisms, while keeping the scene root fixed.
  if (name === 'death') {
    const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    const positions = tracks.find(t => t.name === 'mixamorigHips.position'), offsets = [];
    for (const time of times) {
      mixer.setTime(time); model.updateMatrixWorld(true);
      model.traverse(n => { if (n.isSkinnedMesh) { n.skeleton.update(); n.computeBoundingBox(); } });
      offsets.push(Math.max(0, -new THREE.Box3().setFromObject(model).min.y));
    }
    mixer.stopAllAction(); mixer.uncacheRoot(model);
    for (let i = 0; i < times.length; i++) positions.values[i * 3 + 1] += offsets[i];
  }
  clips.push(clip);
}
const referenceTracks = [];
model.traverse(n => {
  if (!n.isBone && ![gear, coreRotor, ...drills].includes(n)) return;
  referenceTracks.push(new THREE.QuaternionKeyframeTrack(`${n.name}.quaternion`, [0, 1 / 30], [...n.quaternion.toArray(), ...n.quaternion.toArray()]));
  if (n.isBone) referenceTracks.push(new THREE.VectorKeyframeTrack(`${n.name}.position`, [0, 1 / 30], [...n.position.toArray(), ...n.position.toArray()]));
});
clips.push(new THREE.AnimationClip('reference_pose', 1 / 30, referenceTracks));
model.updateMatrixWorld(true);
model.traverse(n => { if (n.isSkinnedMesh) { n.skeleton.update(); n.computeBoundingBox(); } });
const scene = new THREE.Group(); scene.name = 'dust'; scene.add(model);
const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
model.scale.setScalar(7 / height);
scene.userData = { fps: 30, front: '+Z', up: '+Y', referenceHeight: 7, clips: DUST_CLIPS };
const data = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips, onlyVisible: false });
await fs.writeFile(path.join(output, 'dust.glb'), Buffer.from(data));
await fs.copyFile(path.join(output, 'dust.glb'), path.join(root, 'public/models/dust.glb'));
await fs.writeFile(path.join(output, 'animations.json'), JSON.stringify({ fps: 30, units: 'meters', height: 7, front: '+Z', up: '+Y', source: '../../3Dmodels/sand boss', clips: DUST_CLIPS }, null, 2) + '\n');
console.log(`Exported dust.glb: ${data.byteLength} bytes, ${bones.size} original bones, ${clips.length} clips.`);
