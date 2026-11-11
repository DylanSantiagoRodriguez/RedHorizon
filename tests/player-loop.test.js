import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { AnimationClip, QuaternionKeyframeTrack, Quaternion } from 'three';
import { closeAnimationLoop } from '../src/graphics/AnimationLoop.js';

it('el GLB real no salta de pose al repetir el desplazamiento lateral derecho', () => {
  const bytes = readFileSync('public/models/player/player.glb'), length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length)), binary = 28 + length;
  const read = index => {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const size = accessor.type === 'VEC4' ? 4 : 1;
    return new Float32Array(bytes.buffer, bytes.byteOffset + binary + (view.byteOffset || 0) + (accessor.byteOffset || 0), accessor.count * size);
  };
  const animation = gltf.animations.find(a => a.name === 'strafe_right');
  const tracks = animation.channels.filter(c => c.target.path === 'rotation').map(channel => {
    const sampler = animation.samplers[channel.sampler];
    return new QuaternionKeyframeTrack(gltf.nodes[channel.target.node].name + '.quaternion', read(sampler.input), read(sampler.output));
  });
  const source = new AnimationClip('strafe_right', -1, tracks), loop = closeAnimationLoop(source);
  const a = new Quaternion(), b = new Quaternion();
  const seam = clip => Math.max(...clip.tracks.map(track => {
    const sample = track.createInterpolant();
    a.fromArray(sample.evaluate(clip.duration - .0001));
    b.fromArray(sample.evaluate(.0001));
    return a.angleTo(b);
  }));
  expect(seam(source)).toBeGreaterThan(.7); // Reproduces the shipped knee snap.
  expect(seam(loop)).toBeLessThan(.002);
  expect(seam(source)).toBeGreaterThan(.7); // Source data stays untouched.
  // Closing the loop must not replace the gait with a static pose.
  const knee = loop.tracks.find(t => t.name.includes('LeftLeg')).createInterpolant();
  a.fromArray(knee.evaluate(0));
  const excursion = Array.from({ length: 30 }, (_, i) => a.angleTo(b.fromArray(knee.evaluate(i / 30 * loop.duration))));
  expect(Math.max(...excursion)).toBeGreaterThan(.1);
});
