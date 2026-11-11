import { test, expect } from '@playwright/test';

test('real narration files decode, fit their shots, and respect pause, volume and reset', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?qa'); await page.locator('#start').click();
  const result = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; g.pause(); await g.audio.narration.ready;
    g.view.renderer.setAnimationLoop(null); await g.audio.context.resume();
    const n = g.audio.narration;
    g.run.mission.phase = 'cinematic'; g.run.mission.cinematic = 1.55;
    n.sync(g.run.mission, true); const offset = n.offset, first = n.source;
    n.sync(g.run.mission, false); const stopped = n.source === null;
    n.sync(g.run.mission, true); const resumed = n.source !== first && n.offset === offset;
    const duration = n.buffers.map(b => b.duration);
    g.audio.setVolume(0); const muted = g.audio.volume === 0;
    g.run.mission.cinematic = 5.5; n.sync(g.run.mission, true); const second = n.index;
    g.run.mission.cinematic = 15.5; n.sync(g.run.mission, true); const thirdPlaying = n.index === 2 && n.source.buffer === n.buffers[2];
    g.run.mission.cinematic = 16.5; n.sync(g.run.mission, false); n.sync(g.run.mission, true);
    const thirdResumed = n.index === 2 && n.offset === 1;
    g.createRun('NARRATION-RESET'); const reset = n.source === null && n.index === -1;
    return { duration, offset, stopped, resumed, muted, second, thirdPlaying, thirdResumed, reset };
  });
  expect(result.duration[0]).toBeGreaterThan(3); expect(result.duration[0] + .55).toBeLessThan(5);
  expect(result.duration[1]).toBeGreaterThan(5); expect(result.duration[1] + 5.5).toBeLessThan(15);
  expect(result.duration).toHaveLength(3);
  expect(result.duration[2]).toBeGreaterThan(1); expect(result.duration[2] + 15.5).toBeLessThan(24);
  console.log('Narration durations (seconds):', result.duration);
  expect(result).toMatchObject({ offset: 1, stopped: true, resumed: true, muted: true, second: 1, thirdPlaying: true, thirdResumed: true, reset: true });
  expect(errors).toEqual([]);
});
