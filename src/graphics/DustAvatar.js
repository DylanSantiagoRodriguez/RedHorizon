import { Group, LoopOnce, LoopRepeat, Vector3 } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
import { DUST_CLIPS } from '../data/dustAnimations.js';

export async function loadDustAvatar(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/dust.glb');
  const root = new Group(); root.name = 'dust-avatar'; root.add(asset.scene); parent.add(root);
  asset.scene.traverse(node => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
  });
  for (const [name, action] of Object.entries(asset.actions)) {
    action.setLoop(DUST_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, DUST_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !DUST_CLIPS[name]?.loop;
  }
  let current = null, currentKey = null, lastTime = null, deathAt = null;
  const position = new Vector3();
  return {
    root,
    get clip() { return current?.getClip().name; },
    socket(name) { return asset.scene.getObjectByName(name)?.getWorldPosition(position); },
    update(enemy, time) {
      const dt = lastTime === null ? 0 : Math.max(0, time - lastTime); lastTime = time;
      if (enemy.dead && deathAt === null) deathAt = time;
      const name = enemy.dead ? 'death' : enemy.stun > 0 || enemy.state === 'Stunned' ? 'stunned' : enemy.dustAction?.name || (['Chase', 'Retreat'].includes(enemy.state) ? 'move' : 'idle');
      const key = `${name}:${enemy.dustAction?.startedAt ?? ''}`;
      root.position.y = -enemy.height;
      if (key !== currentKey) {
        const next = asset.actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        // Catch up if loading finished after an attack started.
        next.time = enemy.dustAction && name === enemy.dustAction.name ? Math.max(0, time - enemy.dustAction.startedAt) : 0;
        if (current && current !== next) { current.fadeOut(name === 'stunned' ? 0.06 : 0.12); next.fadeIn(name === 'stunned' ? 0.06 : 0.12); }
        current = next; currentKey = key;
        asset.update(0);
      } else asset.update(dt);
      if (name === 'move') current.setEffectiveTimeScale(enemy.phase === 2 ? 1.35 : 1);
      return deathAt !== null && time - deathAt >= DUST_CLIPS.death.duration + 0.5;
    },
    reset() { for (const action of Object.values(asset.actions)) action.stop(); current = null; currentKey = null; lastTime = null; deathAt = null; },
    dispose() { asset.dispose(); root.removeFromParent(); },
  };
}
