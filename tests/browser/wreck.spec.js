import { test, expect } from '@playwright/test';

test('burning Aurora replaces the wreck, preserves access, pauses and disposes effects', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?qa');
  const result = await page.evaluate(async () => {
    const g = window.__RED_HORIZON__; g.start('WRECK-QA'); g.pause();
    await Promise.all([g.world.wreckReady, g.world.environmentReady, g.missionView.auroraReady]);
    g.view.renderer.setAnimationLoop(null);
    const world = g.world, wreck = world.wreck;
    world.update(10);
    const before = Array.from(wreck.batches[0].geometry.getAttribute('position').array);
    world.update(10);
    const paused = before.every((v, i) => v === wreck.batches[0].geometry.getAttribute('position').array[i]);
    world.update(11);
    const animated = before.some((v, i) => v !== wreck.batches[0].geometry.getAttribute('position').array[i]);
    const beacon = world.beacons.find(b => b.type === 'wreck');
    const accessible = world.obstacles.every(o => Math.hypot(beacon.x - o.x, beacon.z - o.z) > o.radius + .7);
    let colliderCount = 0, wreckColor, auroraColor;
    wreck.root.traverse(n => { if (n.isMesh) { if (world.cameraColliders.includes(n)) colliderCount++; wreckColor ??= n.material.color.r; } });
    g.missionView.aurora.root.traverse(n => { if (n.isMesh) auroraColor ??= n.material.color.r; });
    document.querySelector('#interface').hidden = true;
    g.view.sun.position.set(15, 65, 0); g.view.sun.target.position.set(36, 0, 12);
    g.view.camera.position.set(17, wreck.root.position.y + 13, 34);
    g.view.camera.lookAt(36, wreck.root.position.y + 2, 12);
    g.view.draw();
    return { loaded: !!wreck, fallback: world.wreckFallback.visible, paused, animated, accessible, colliderCount,
      batches: wreck.batches.length, particles: wreck.batches.reduce((n, b) => n + b.seeds.length, 0),
      separateMaterials: Math.abs(wreckColor / auroraColor - .62) < .001 };
  });
  expect(result).toMatchObject({ loaded: true, fallback: false, paused: true, animated: true, accessible: true, batches: 3, particles: 90, separateMaterials: true });
  expect(result.colliderCount).toBeGreaterThan(0);
  await page.screenshot({ path: 'outputs/aurora/wreck.png' });
  expect(await page.evaluate(() => {
    const w = window.__RED_HORIZON__.world, wreck = w.wreck; let disposed = 0;
    wreck.batches.forEach(b => b.geometry.addEventListener('dispose', () => disposed++));
    w.dispose(); return { disposed, removed: wreck.root.parent === null };
  })).toEqual({ disposed: 3, removed: true });
  expect(errors).toEqual([]);
});
