import { Box3, Group, LoopOnce, LoopRepeat, Mesh, SphereGeometry, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
import { AMETHYST_CLIPS, AMETHYST_SCALE } from '../data/amethystAnimations.js';

export async function loadAmethystAvatar(parent) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/amethyst.glb');
  const root = new Group(); root.name = 'amethyst-avatar'; root.add(asset.scene); parent.add(root); root.scale.setScalar(AMETHYST_SCALE);
  const metals = new Set();
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true; node.frustumCulled = false;
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if (mat.emissive) { mat.emissive.setHex(0xb060ff); metals.add(mat); }
    }
  });
  const coreMaterial = new MeshStandardMaterial({ color: 0x351055, emissive: 0xb060ff, emissiveIntensity: 0 });
  const core = new Mesh(new SphereGeometry(.04, 16, 12), coreMaterial);
  core.name = 'amethyst-core';
  const light = new PointLight(0xb060ff, 0, 5, 2);
  const socket = asset.scene.getObjectByName('core_socket'); socket.add(core, light);
  for (const [name, action] of Object.entries(asset.actions)) {
    action.setLoop(AMETHYST_CLIPS[name]?.loop ? LoopRepeat : LoopOnce, AMETHYST_CLIPS[name]?.loop ? Infinity : 1);
    action.clampWhenFinished = !AMETHYST_CLIPS[name]?.loop;
  }
  let current, key, lastTime, deathAt, landedAt;
  const position = new Vector3();
  return {
    root,
    bounds() { parent.updateMatrixWorld(true); asset.scene.traverse(n => n.skeleton?.update()); return new Box3().setFromObject(asset.scene, true); },
    get clip() { return current?.getClip().name; },
    get clipTime() { return current?.time; },
    get coreIntensity() { return coreMaterial.emissiveIntensity; },
    socket(name) { return asset.scene.getObjectByName(name)?.getWorldPosition(position); },
    update(enemy, time, world) {
      const dt = lastTime === undefined ? 0 : Math.max(0, time-lastTime); lastTime = time;
      if (enemy.dead && deathAt === undefined) deathAt = enemy.amethystDeathAt ?? time;
      const action = !enemy.dead && enemy.stun <= 0 ? enemy.amethystAction : null;
      const name = enemy.dead ? 'death' : action?.name || (enemy.stun > 0 || enemy.state === 'Stunned' ? 'idle' : enemy.state === 'Chase' ? 'move' : 'idle');
      const nextKey = `${name}:${action?.startedAt ?? ''}`;
      root.position.y = 0;
      if (key !== nextKey) {
        const next = asset.actions[name]; next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        if (current && current !== next) { current.fadeOut(name === 'death' ? .06 : .12); next.fadeIn(name === 'death' ? .06 : .12); }
        current = next; key = nextKey;
      }
      current.setEffectiveTimeScale(name === 'move' ? (enemy.phase === 2 ? 1.35 : 1) : action?.speed ?? 1);
      asset.update(dt);
      if (action || enemy.dead) {
        current.time = Math.min(AMETHYST_CLIPS[name].duration, action ? Math.max(0,time-action.startedAt)*action.speed : time-deathAt);
        asset.update(0);
      }
      const power = enemy.dead ? Math.max(0,1-(time-deathAt)/1.5) : 1;
      const pulse = name === 'attack_special' ? 1+.65*Math.exp(-Math.pow((current.time-1)/.18,2)) : 1+.12*Math.sin(time*3);
      coreMaterial.emissiveIntensity = 0.8*power*pulse; light.intensity = 1.5*power*pulse;
      for (const mat of metals) mat.emissiveIntensity = .025*power*pulse;
      if (enemy.dead) {
        const elapsed = Math.max(0,time-deathAt);
        parent.position.y = enemy.y - 4.905*elapsed*elapsed;
        const box = this.bounds();
        const ground = Math.max(...[[enemy.x,enemy.z],[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z])=>world.heightAt(x,z)));
        if (box.min.y <= ground) { parent.position.y += ground-box.min.y; parent.updateMatrixWorld(true); landedAt ??= time; }
      }
      return deathAt !== undefined && landedAt !== undefined && time-deathAt+1e-8 >= AMETHYST_CLIPS.death.duration && time-landedAt+1e-8 >= .5;
    },
    reset() { asset.mixer.stopAllAction(); current = key = lastTime = deathAt = landedAt = undefined; },
    dispose() { light.dispose(); asset.dispose(); root.removeFromParent(); },
  };
}
