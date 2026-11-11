import { Group, LoopOnce, LoopRepeat, Mesh, SphereGeometry, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
import { EMERALD_CLIPS } from '../data/emeraldAnimations.js';

export async function loadEmeraldAvatar(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/emerald.glb');
  const root = new Group(); root.name = 'emerald-avatar'; root.add(asset.scene); parent.add(root);
  const metals = new Set();
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true; node.frustumCulled = false;
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if (mat.emissive) { mat.emissive.setHex(0x40ef80); metals.add(mat); }
    }
  });
  const coreMaterial = new MeshStandardMaterial({ color: 0x10552b, emissive: 0x40ef80, emissiveIntensity: 0 });
  const core = new Mesh(new SphereGeometry(.32, 16, 12), coreMaterial);
  core.name = 'emerald-core';
  const light = new PointLight(0x40ef80, 0, 5, 2);
  const socket = asset.scene.getObjectByName('core_socket'); socket.add(core, light);
  for (const [name, action] of Object.entries(asset.actions)) {
    action.setLoop(EMERALD_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, EMERALD_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !EMERALD_CLIPS[name]?.loop;
  }
  let current, key, lastTime, deathAt;
  const position = new Vector3();
  return {
    root,
    get clip() { return current?.getClip().name; },
    get clipTime() { return current?.time; },
    get coreIntensity() { return coreMaterial.emissiveIntensity; },
    socket(name) { return asset.scene.getObjectByName(name)?.getWorldPosition(position); },
    update(enemy, time) {
      const dt = lastTime === undefined ? 0 : Math.max(0, time-lastTime); lastTime = time;
      if (enemy.dead && deathAt === undefined) deathAt = time;
      const action = !enemy.dead && enemy.stun <= 0 ? enemy.emeraldAction : null;
      const name = enemy.dead ? 'death' : action?.name || (enemy.stun > 0 || enemy.state === 'Stunned' ? 'idle' : enemy.state === 'Chase' ? 'move' : 'idle');
      const nextKey = `${name}:${action?.startedAt ?? ''}`;
      root.position.y = -enemy.height;
      if (key !== nextKey) {
        const next = asset.actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        if (current && current !== next) { current.fadeOut(name === 'death' ? .06 : .12); next.fadeIn(name === 'death' ? .06 : .12); }
        current = next; key = nextKey;
      }
      current.setEffectiveTimeScale(name === 'move' ? (enemy.phase === 2 ? 1.35 : 1) : action?.speed ?? 1);
      asset.update(dt);
      if (action || enemy.dead) {
        current.time = Math.min(EMERALD_CLIPS[name].duration, action ? Math.max(0,time-action.startedAt)*action.speed : time-deathAt);
        asset.update(0);
      }
      const power = enemy.dead ? Math.max(0,1-(time-deathAt)/1.5) : 1;
      const pulse = name === 'attack_special' ? 1+2*Math.exp(-Math.pow((current.time-.8)/.18,2)) : 1+.12*Math.sin(time*3);
      coreMaterial.emissiveIntensity = 3*power*pulse; light.intensity = 8*power*pulse;
      for (const mat of metals) mat.emissiveIntensity = .13*power*pulse;
      return deathAt !== undefined && time-deathAt+1e-8 >= EMERALD_CLIPS.death.duration+.5;
    },
    reset() { asset.mixer.stopAllAction(); current = key = lastTime = deathAt = undefined; },
    dispose() { light.dispose(); asset.dispose(); root.removeFromParent(); },
  };
}
