import { AnimationMixer, Box3, Vector3, Group, LoopOnce, LoopRepeat } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { DRONE_CLIPS } from '../data/droneAnimations.js';
import { ENEMIES } from '../data/enemies.js';

// Share immutable geometry/textures across the horde; each instance owns its rig and mixer.
let templatePromise;
export async function loadDroneAvatar(parent) {
  templatePromise ??= new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/drone.glb')
    .catch(error => { templatePromise = null; throw error; });
  const template = await templatePromise, model = clone(template.scene);
  const root = new Group(); root.name = 'drone-avatar'; root.add(model); parent.add(root);
  root.rotation.y = 0; // Asset and gameplay both face +Z.
  root.scale.setScalar(1); // Keep the delivered original asset scale.
  model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; } });
  const mixer = new AnimationMixer(model);
  const actions = Object.fromEntries(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  for (const [name, action] of Object.entries(actions)) {
    action.setLoop(DRONE_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, DRONE_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !DRONE_CLIPS[name]?.loop;
  }
  let current, key, lastTime, deathAt, landedAt;
  return {
    root,
    socket() { parent.updateMatrixWorld(true); return model.getObjectByName('muzzle_socket').getWorldPosition(new Vector3()); },
    bounds() { parent.updateMatrixWorld(true); model.traverse(n => n.skeleton?.update()); return new Box3().setFromObject(model, true); },
    get clip() { return current?.getClip().name; },
    get clipTime() { return current?.time; },
    update(enemy, time, world) {
      const dt = lastTime === undefined ? 0 : Math.max(0, time - lastTime); lastTime = time;
      if (enemy.dead && deathAt === undefined) deathAt = enemy.droneDeathAt ?? time;
      const attack = !enemy.dead && enemy.stun <= 0 && enemy.state !== 'Stunned' ? enemy.droneAction : null;
      const name = enemy.dead ? 'death' : attack ? 'attack_ranged' : enemy.stun > 0 || enemy.state === 'Stunned' ? 'hover' : enemy.state === 'Chase' ? 'move_forward' : enemy.state === 'Retreat' ? 'move_backward' : 'hover';
      const nextKey = `${name}:${attack?.startedAt ?? ''}`;
      root.position.y = 0;
      if (key !== nextKey) {
        const next = actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        if (current && current !== next) { current.fadeOut(name === 'death' ? 0.06 : 0.12); next.fadeIn(name === 'death' ? 0.06 : 0.12); }
        current = next; key = nextKey;
      }
      current.setEffectiveTimeScale(name.startsWith('move_') ? enemy.speed / ENEMIES.drone.speed : attack?.speed ?? 1);
      mixer.update(dt);
      // Absolute simulation time also handles late loading and skipped render frames.
      if (attack || enemy.dead) {
        current.time = Math.min(DRONE_CLIPS[name].duration, attack ? Math.max(0, time - attack.startedAt) * attack.speed : time - deathAt);
        mixer.update(0);
      }
      if (enemy.dead) {
        const elapsed = Math.max(0, time - deathAt);
        parent.position.y = enemy.y - 4.905 * elapsed * elapsed;
        parent.updateMatrixWorld(true);
        model.traverse(n => n.skeleton?.update());
        const box = new Box3().setFromObject(model, true);
        const ground = Math.max(...[[enemy.x,enemy.z],[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z]) => world.heightAt(x,z)));
        if (box.min.y <= ground) {
          parent.position.y += ground - box.min.y;
          parent.updateMatrixWorld(true);
          model.traverse(n => n.skeleton?.update());
          landedAt ??= time;
        }
      }
      return deathAt !== undefined && landedAt !== undefined && time - deathAt >= DRONE_CLIPS.death.duration && time - landedAt >= .5;
    },
    reset() { mixer.stopAllAction(); current = key = lastTime = deathAt = landedAt = undefined; },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      model.traverse(n => n.skeleton?.dispose()); root.removeFromParent();
    },
  };
}
