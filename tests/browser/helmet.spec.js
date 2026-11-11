import { test, expect } from '@playwright/test';

test('cinematic helmet rests on terrain, stays framed, and yields to Aurora', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?qa'); await page.locator('#start').click();
  await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; g.pause();
    await Promise.all([g.missionView.helmetReady, g.missionView.auroraReady, g.world.environmentReady]);
    g.view.renderer.setAnimationLoop(null);
    g.state.value = 'playing'; g.ui.show('playing');
    g.missionView.update();
  });
  expect(await page.evaluate(() => window.__RED_HORIZON__.missionView.helmet.visible)).toBe(false);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 600, height: 900 }]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const g = window.__RED_HORIZON__, m = g.missionView;
      g.view.resize(); g.run.mission.phase = 'cinematic';
      const frames = [];
      for (const time of [5, 10, 14.99]) {
        g.run.mission.cinematic = time; m.update();
        g.view.camera.updateMatrixWorld(true); g.view.scene.updateMatrixWorld(true);
        let inside = true, clearance = Infinity;
        m.helmetModel.root.traverse(node => {
          if (!node.isMesh) return;
          const vertices = node.geometry.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            const point = g.view.camera.position.clone().fromBufferAttribute(vertices, i).applyMatrix4(node.matrixWorld);
            clearance = Math.min(clearance, point.y - g.world.heightAt(point.x, point.z));
            point.project(g.view.camera);
            inside &&= Math.abs(point.x) < .95 && Math.abs(point.y) < .95 && point.z > -1 && point.z < 1;
          }
        });
        frames.push({ inside, clearance });
      }
      g.run.mission.cinematic = 10; m.update();
      const before = g.view.camera.position.toArray(); m.update();
      g.view.draw();
      return { frames, paused: before.every((v, i) => v === g.view.camera.position.toArray()[i]), fallback: m.helmetFallback.visible };
    });
    expect(result.paused).toBe(true); expect(result.fallback).toBe(false);
    for (const frame of result.frames) { expect(frame.inside).toBe(true); expect(frame.clearance).toBeCloseTo(.01, 4); }
    await page.screenshot({ path: `outputs/helmet/cinematic-${viewport.width}.png` });
  }
  expect(await page.evaluate(() => {
    const g = window.__RED_HORIZON__; g.run.mission.cinematic = 15; g.missionView.update();
    return { helmet: g.missionView.helmet.visible, aurora: g.missionView.ark.visible };
  })).toEqual({ helmet: false, aurora: true });
  expect(errors).toEqual([]);
});
