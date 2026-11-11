import { AnimationMixer, Group, LoopOnce, LoopRepeat } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ELTE_CLIPS } from '../data/elteAnimations.js';
import { ENEMIES } from '../data/enemies.js';

// Share immutable geometry/textures across the horde; each instance owns its rig and mixer.
let templatePromise;
export async function loadElteAvatar(parent) {
  templatePromise ??= new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/elte.glb')
    .catch(error => { templatePromise = null; throw error; });
  const template = await templatePromise, model = clone(template.scene);
  const root = new Group(); root.name = 'elte-avatar'; root.add(model); parent.add(root);
  root.rotation.y = 0; // Asset and gameplay both face +Z.
  root.scale.setScalar(1); // Keep the delivered 2 m reference height.
  model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; } });
  const mixer = new AnimationMixer(model);
  const actions = Object.fromEntries(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  for (const [name, action] of Object.entries(actions)) {
    action.setLoop(ELTE_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, ELTE_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !ELTE_CLIPS[name]?.loop;
  }
  let current, key, lastTime, deathAt;
  return {
    root,
    get clip() { return current?.getClip().name; },
    get clipTime() { return current?.time; },
    update(enemy, time) {
      const dt = lastTime === undefined ? 0 : Math.max(0, time - lastTime); lastTime = time;
      if (enemy.dead && deathAt === undefined) deathAt = time;
      const attack = !enemy.dead && enemy.stun <= 0 && enemy.state !== 'Stunned' ? enemy.elteAction : null;
      const name = enemy.dead ? 'death' : attack ? attack.name : enemy.stun > 0 || enemy.state === 'Stunned' ? 'idle' : enemy.state === 'Chase' ? 'move' : 'idle';
      const nextKey = `${name}:${attack?.startedAt ?? ''}`;
      root.position.y = -enemy.height;
      if (key !== nextKey) {
        const next = actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        if (current && current !== next) { current.fadeOut(name === 'death' ? 0.06 : 0.08); next.fadeIn(name === 'death' ? 0.06 : 0.08); }
        current = next; key = nextKey;
      }
      current.setEffectiveTimeScale(name === 'move' ? enemy.speed / ENEMIES.elite.speed : attack?.speed ?? 1);
      mixer.update(dt);
      // Absolute simulation time also handles late loading and skipped render frames.
      if (attack || enemy.dead) {
        current.time = Math.min(ELTE_CLIPS[name].duration, attack ? Math.max(0, time - attack.startedAt) * attack.speed : time - deathAt);
        mixer.update(0);
      }
      return deathAt !== undefined && time - deathAt >= ELTE_CLIPS.death.duration + 0.5;
    },
    reset() { mixer.stopAllAction(); current = key = lastTime = deathAt = undefined; },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      model.traverse(n => n.skeleton?.dispose()); root.removeFromParent();
    },
  };
}
