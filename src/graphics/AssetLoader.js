import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// GLB assets are served locally with the game; each instance owns its mixer/resources.
export async function loadAnimatedModel(url) {
  const asset = await new GLTFLoader().loadAsync(url);
  const mixer = new AnimationMixer(asset.scene);
  const actions = Object.fromEntries(asset.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  return { scene: asset.scene, actions, update: dt => mixer.update(dt), dispose() {
    mixer.stopAllAction(); mixer.uncacheRoot(asset.scene);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    asset.scene.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.add(mat); });
    for (const mat of materials) { for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); mat.dispose(); }
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); asset.scene.removeFromParent();
  } };
}
