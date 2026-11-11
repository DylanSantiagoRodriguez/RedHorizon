import { afterEach, expect, it, vi } from 'vitest';
import { CinematicNarration } from '../src/audio/CinematicNarration.js';

afterEach(() => vi.unstubAllGlobals());
async function create() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
  const sources = [];
  const context = {
    state: 'running', currentTime: 0,
    createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
    decodeAudioData: async () => ({ duration: 3 }),
    createBufferSource: () => {
      const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source); return source;
    },
  };
  const voice = new CinematicNarration(context, {}); await voice.ready;
  return { voice, context, sources, sync: (t, active = true) => voice.sync({ phase: 'cinematic', cinematic: t }, active) };
}
it('does not repeat a phrase on successive render frames or after its natural end', async () => {
  const { sync, sources, context } = await create();
  sync(.3); expect(sources).toHaveLength(0);
  sync(.55); sync(.55); expect(sources).toHaveLength(1);
  context.currentTime = 1; sync(1.55); expect(sources).toHaveLength(1);
  sources[0].onended(); sync(1.55); expect(sources).toHaveLength(1);
});
it('pauses immediately and resumes at the cinematic offset instead of restarting', async () => {
  const { sync, sources, context } = await create();
  sync(1.55); sync(1.55, false); expect(sources[0].stop).toHaveBeenCalledOnce();
  context.currentTime = 20; sync(1.55);
  expect(sources[1].start).toHaveBeenCalledWith(0, 1);
});
it('changes through all three cues without overlapping', async () => {
  const { sync, sources, voice } = await create();
  sync(.55); sync(5.5);
  expect(sources[0].stop).toHaveBeenCalledOnce(); expect(voice.index).toBe(1);
  sync(15.5); expect(sources[1].stop).toHaveBeenCalledOnce(); expect(voice.index).toBe(2);
  expect(sources).toHaveLength(3);
  expect(sources[2].start).toHaveBeenCalledWith(0, 0);
});
it('resynchronizes after a delayed frame and stops outside the cinematic', async () => {
  const { sync, context, sources, voice } = await create();
  sync(.55); context.currentTime = 2; sync(1);
  expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[1].start.mock.calls[0][1]).toBeCloseTo(.45);
  voice.sync({ phase: 'collect', cinematic: 1 }, true);
  expect(sources[1].stop).toHaveBeenCalledOnce();
  sync(.55); expect(sources).toHaveLength(3);
  voice.dispose(); expect(sources[2].stop).toHaveBeenCalledOnce(); expect(voice.gain.disconnect).toHaveBeenCalledOnce();
});
