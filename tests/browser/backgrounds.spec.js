import { test, expect } from '@playwright/test';

test('planet panorama switches to space only for Aurora and resets on a new run', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?qa'); await page.locator('#start').click();
  const loaded = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; g.pause();
    await Promise.all([g.view.backdrop.ready, g.missionView.auroraReady, g.world.environmentReady]);
    g.view.renderer.setAnimationLoop(null); g.state.value = 'playing'; g.ui.show('playing');
    g.missionView.update();
    g.view.camera.position.set(8, 6, 10); g.view.camera.lookAt(-4, 12, -20);
    g.view.draw();
    const b = g.view.backdrop;
    return { mode: b.mode, names: Object.values(b.textures).map(t => t.name).sort(), loaded: b.material.uniforms.loaded.value,
      centered: b.mesh.position.equals(g.view.camera.position) };
  });
  expect(loaded).toEqual({ mode: 'planet', names: ['planet-panorama', 'space-panorama'], loaded: true, centered: true });
  await page.screenshot({ path: 'outputs/backgrounds/planet.png' });
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__;
    g.run.mission.phase = 'cinematic';
    return [4.9, 5, 14.99, 15, 19].map(t => {
      g.run.mission.cinematic = t; g.missionView.update();
      return g.view.backdrop.mode;
    });
  })).toEqual(['planet', 'planet', 'planet', 'space', 'space']);
  for (const width of [1440, 600]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => {
      const g = window.__RED_HORIZON__; g.view.resize(); g.missionView.update(); g.view.draw();
      return { mode: g.view.backdrop.material.uniforms.panorama.value.name,
        centered: g.view.backdrop.mesh.position.equals(g.view.camera.position), fog: g.view.scene.fog.density };
    })).toEqual({ mode: 'space-panorama', centered: true, fog: 0 });
    await page.screenshot({ path: `outputs/backgrounds/aurora-${width}.png` });
  }
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__, original = g.view.backdrop.textures.planet;
    g.createRun('BACKGROUND-RESET'); g.missionView.update();
    return { mode: g.view.backdrop.mode, reused: g.view.backdrop.material.uniforms.panorama.value === original, fog: g.view.scene.fog.density };
  })).toEqual({ mode: 'planet', reused: true, fog: .0075 });
  expect(errors).toEqual([]);
});

test('missing background images retain a usable gradient for each shot', async ({ page }) => {
  await page.route('**/textures/backgrounds/*.png', route => route.abort());
  await page.goto('/?qa');
  expect(await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; await g.view.backdrop.ready;
    g.view.renderer.setAnimationLoop(null);
    const b = g.view.backdrop, modes = [];
    for (const mode of ['planet', 'space']) {
      b.setMode(mode); g.view.draw(); modes.push({ mode: b.mode, loaded: b.material.uniforms.loaded.value, texture: b.material.uniforms.panorama.value });
    }
    return modes;
  })).toEqual([{ mode: 'planet', loaded: false, texture: null }, { mode: 'space', loaded: false, texture: null }]);
});
