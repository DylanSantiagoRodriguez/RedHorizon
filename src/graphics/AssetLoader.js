import { AnimationMixer } from 'three';
import { loadModel } from './ModelTextures.js';
// Load bundled GLB models and own their animation, mesh and texture resources.
export async function loadAnimatedModel(url) {
  const asset = await loadModel(url);
  const mixer = new AnimationMixer(asset.scene);
  const actions = Object.fromEntries(asset.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  return { scene: asset.scene, actions, clips: asset.animations, mixer, update: dt => mixer.update(dt), dispose() {
    mixer.stopAllAction(); mixer.uncacheRoot(asset.scene);
    const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
    asset.scene.traverse(node => { if (node.skeleton) skeletons.add(node.skeleton); if (node.geometry) geometries.add(node.geometry); if (node.material) for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.add(mat); });
    for (const mat of materials) { for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); mat.dispose(); }
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); skeletons.forEach(s => s.dispose()); asset.scene.removeFromParent();
  } };
}
