import { AnimationMixer, Vector3, Group, LoopOnce, LoopRepeat } from 'three';
import { loadModel } from './ModelTextures.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { SPITTER_CLIPS } from '../data/spitterAnimations.js';
import { ENEMIES } from '../data/enemies.js';

// Share immutable geometry/textures across the horde; each instance owns its rig and mixer.
let templatePromise;
export async function loadSpitterAvatar(parent) {
  templatePromise ??= loadModel(import.meta.env.BASE_URL + 'models/spitter.glb')
    .catch(error => { templatePromise = null; throw error; });
  const template = await templatePromise, model = clone(template.scene);
  const root = new Group(); root.name = 'spitter-avatar'; root.add(model); parent.add(root);
  root.rotation.y = 0; // Asset and gameplay both face +Z.
  root.scale.setScalar(1); // Keep the delivered 1.8 m reference height.
  model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; } });
  const mixer = new AnimationMixer(model);
  const actions = Object.fromEntries(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  for (const [name, action] of Object.entries(actions)) {
    action.setLoop(SPITTER_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, SPITTER_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !SPITTER_CLIPS[name]?.loop;
  }
  let current, key, lastTime, deathAt;
  return {
    root,
    socket() { root.updateWorldMatrix(true, true); return model.getObjectByName('muzzle_socket').getWorldPosition(new Vector3()); },
    get clip() { return current?.getClip().name; },
    get clipTime() { return current?.time; },
    update(enemy, time) {
      const dt = lastTime === undefined ? 0 : Math.max(0, time - lastTime); lastTime = time;
      if (enemy.dead && deathAt === undefined) deathAt = time;
      const attack = !enemy.dead && enemy.stun <= 0 && enemy.state !== 'Stunned' ? enemy.spitterAction : null;
      const name = enemy.dead ? 'death' : attack ? 'attack_ranged' : enemy.stun > 0 || enemy.state === 'Stunned' ? 'idle' : enemy.state === 'Chase' ? 'move_forward' : enemy.state === 'Retreat' ? 'move_backward' : 'idle';
      const nextKey = `${name}:${attack?.startedAt ?? ''}`;
      root.position.y = -enemy.height;
      if (key !== nextKey) {
        const next = actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        if (current && current !== next) { current.fadeOut(name === 'death' ? 0.06 : 0.12); next.fadeIn(name === 'death' ? 0.06 : 0.12); }
        current = next; key = nextKey;
      }
      current.setEffectiveTimeScale(name.startsWith('move_') ? enemy.speed / ENEMIES.spitter.speed : attack?.speed ?? 1);
      mixer.update(dt);
      // Absolute simulation time also handles late loading and skipped render frames.
      if (attack || enemy.dead) {
        current.time = Math.min(SPITTER_CLIPS[name].duration, attack ? Math.max(0, time - attack.startedAt) * attack.speed : time - deathAt);
        mixer.update(0);
      }
      return deathAt !== undefined && time - deathAt >= SPITTER_CLIPS.death.duration + 0.5;
    },
    reset() { mixer.stopAllAction(); current = key = lastTime = deathAt = undefined; },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      model.traverse(n => n.skeleton?.dispose()); root.removeFromParent();
    },
  };
}
