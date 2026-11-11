import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let textureLimit = Infinity;
export function setModelQuality(quality) { textureLimit = quality === 'low' ? 1024 : Infinity; }

// Resize decoded images before uploading them to WebGL. Keep shared material
// sources shared, preserve aspect ratio, and release the original CPU bitmap.
export async function limitModelTextures(scene, limit, resize = globalThis.createImageBitmap) {
  if (!Number.isFinite(limit) || !resize) return;
  const images = new Map();
  scene.traverse(node => {
    for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      for (const texture of Object.values(material)) {
        const source = texture?.isTexture && texture.image;
        if (!source || Math.max(source.width, source.height) <= limit) continue;
        if (!images.has(source)) images.set(source, new Set());
        images.get(source).add(texture);
      }
    }
  });
  for (const [source, textures] of images) {
    const ratio = limit / Math.max(source.width, source.height);
    const image = await resize(source, { resizeWidth: Math.max(1, Math.round(source.width * ratio)), resizeHeight: Math.max(1, Math.round(source.height * ratio)), resizeQuality: 'high', imageOrientation: 'none', premultiplyAlpha: 'none' });
    for (const texture of textures) { texture.image = image; texture.needsUpdate = true; }
    source.close?.();
  }
}

export async function loadModel(url) {
  const limit = textureLimit;
  const asset = await new GLTFLoader().loadAsync(url);
  await limitModelTextures(asset.scene, limit);
  return asset;
}
