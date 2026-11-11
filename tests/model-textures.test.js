import { expect, it, vi } from 'vitest';
import { limitModelTextures } from '../src/graphics/ModelTextures.js';

it('reduce una imagen compartida una sola vez, conserva proporciones y libera el bitmap original', async () => {
  const source = { width: 4096, height: 2048, close: vi.fn() };
  const first = { isTexture: true, image: source }, second = { isTexture: true, image: source };
  const small = { isTexture: true, image: { width: 512, height: 512 } };
  const scene = { traverse: fn => { fn({ material: { map: first, normalMap: second } }); fn({ material: [{ map: first }, { map: small }] }); } };
  const output = { width: 1024, height: 512 };
  const resize = vi.fn(async () => output);
  await limitModelTextures(scene, 1024, resize);
  expect(resize).toHaveBeenCalledExactlyOnceWith(source, expect.objectContaining({ resizeWidth: 1024, resizeHeight: 512, imageOrientation: 'none', premultiplyAlpha: 'none' }));
  expect(first.image).toBe(output); expect(second.image).toBe(output);
  expect(first.needsUpdate && second.needsUpdate).toBe(true);
  expect(source.close).toHaveBeenCalledOnce(); expect(small.image.width).toBe(512);
});

it('conserva las texturas originales en calidad alta', async () => {
  const scene = { traverse: vi.fn() }, resize = vi.fn();
  await limitModelTextures(scene, Infinity, resize);
  expect(scene.traverse).not.toHaveBeenCalled(); expect(resize).not.toHaveBeenCalled();
});

it('no cierra una imagen si falla la conversión', async () => {
  const source = { width: 4096, height: 4096, close: vi.fn() };
  const texture = { isTexture: true, image: source };
  const scene = { traverse: fn => fn({ material: { map: texture } }) };
  await expect(limitModelTextures(scene, 1024, async () => { throw new Error('decode'); })).rejects.toThrow('decode');
  expect(texture.image).toBe(source); expect(source.close).not.toHaveBeenCalled();
});
