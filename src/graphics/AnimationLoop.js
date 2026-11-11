import { Quaternion } from 'three';

// Overlap the tail and head so pose and velocity continue across the loop wrap.
export function closeAnimationLoop(source, overlap = 0.3) {
  const clip = source.clone(), window = Math.min(overlap, source.duration / 3);
  const duration = source.duration - window, frames = Math.ceil(duration * 30);
  const a = new Quaternion(), b = new Quaternion();
  clip.tracks = source.tracks.map(track => {
    const size = track.getValueSize(), sample = track.createInterpolant();
    const times = [], values = [];
    for (let i = 0; i <= frames; i++) {
      const t = i / frames * duration;
      const tail = Array.from(sample.evaluate(t + window));
      if (t > duration - window) {
        const head = sample.evaluate(t - (duration - window));
        const x = (t - (duration - window)) / window, blend = x * x * (3 - 2 * x);
        if (track.ValueTypeName === 'quaternion') {
          a.fromArray(tail).slerp(b.fromArray(head), blend).toArray(tail);
        } else for (let j = 0; j < size; j++) tail[j] += (head[j] - tail[j]) * blend;
      }
      times.push(t); values.push(...tail);
    }
    return new track.constructor(track.name, times, values);
  });
  clip.duration = duration;
  return clip;
}
