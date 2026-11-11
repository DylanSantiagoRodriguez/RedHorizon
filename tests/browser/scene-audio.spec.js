import { test, expect } from '@playwright/test';

test('all five recordings load and follow gameplay, proximity, narration, pause and reset', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?qa'); await page.locator('#start').click();
  const result = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; g.pause();
    await Promise.all([g.audio.sceneAudio.ready, g.audio.narration.ready, g.world.wreckReady]);
    g.view.renderer.setAnimationLoop(null); await g.audio.context.resume(); g.resume();
    const a = g.audio.sceneAudio, r = g.run;
    const durations = Object.fromEntries(Object.entries(a.buffers).map(([name, b]) => [name, b.duration]));
    r.time = 10;
    r.player.x = g.world.wreck.root.position.x - 4; r.player.z = g.world.wreck.root.position.z;
    const update = () => g.audio.update(0, true, r.mission, r, 0);
    update();
    const music = a.tracks.get('music'), fire = a.tracks.get('fire');
    const loops = !!music.source?.loop && !!fire.source?.loop && !a.tracks.get('aurora').source;
    const firstMusic = music.source; update(); const noDuplicates = music.source === firstMusic;
    await new Promise(resolve => setTimeout(resolve, 200));
    const nearGain = fire.gain.gain.value, pan = fire.pan.pan.value;
    r.player.x += 100; update(); const farSilent = !fire.source;
    const altar = r.altars[0]; r.player.x = altar.x; r.player.z = altar.z;
    const awakened = r.boss.awaken(r, altar); update();
    const altarTrack = [...a.tracks.values()].find(t => t.name === 'altar_boss');
    const altarPlaying = !!altarTrack?.source;
    r.mission.phase = 'ready'; r.interaction = r.launchBeacon; r.interact(); update();
    const launch = [...a.tracks.values()].find(t => t.name === 'beacon_launch');
    const launchPlaying = !!launch?.source;
    g.pause(); const paused = [...a.tracks.values()].every(t => !t.source);
    g.resume(); update(); const resumed = !!launch.source && !!music.source;
    r.mission.phase = 'cinematic'; r.mission.cinematic = 16; update();
    const aurora = a.tracks.get('aurora'), voice = !!g.audio.narration.source;
    const cinema = !!aurora.source && !fire.source && [...a.tracks.values()].every(t => t.loop);
    await new Promise(resolve => setTimeout(resolve, 350));
    const ducked = music.gain.gain.value < .05 && aurora.gain.gain.value < .08;
    g.audio.setVolume(0); const muted = g.audio.volume === 0;
    g.createRun('SCENE-AUDIO-RESET'); const reset = a.tracks.size === 0;
    return { durations, loops, noDuplicates, nearGain, pan, farSilent, awakened, altarPlaying, launchPlaying, paused, resumed, voice, cinema, ducked, muted, reset };
  });
  expect(Object.keys(result.durations)).toHaveLength(5);
  for (const duration of Object.values(result.durations)) expect(duration).toBeGreaterThan(1);
  expect(result.nearGain).toBeGreaterThan(.1); expect(result.pan).toBeGreaterThan(.4);
  expect(result).toMatchObject({ loops: true, noDuplicates: true, farSilent: true, awakened: true, altarPlaying: true, launchPlaying: true,
    paused: true, resumed: true, voice: true, cinema: true, ducked: true, muted: true, reset: true });
  console.log('Scene audio durations (seconds):', result.durations);
  expect(errors).toEqual([]);
});
