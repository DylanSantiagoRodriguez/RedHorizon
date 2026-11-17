import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Exercise actual GLTF ImageBitmap fetches with the deployed Nginx policy.
// A successful .glb HTTP response alone does not prove its textures decoded.
test('la CSP de producción permite texturas GLB y los enemigos animan entre snapshots', async ({ page, context, baseURL }) => {
  test.setTimeout(180000);
  // The intercepted document still needs access to Vite's local HMR socket.
  await context.grantPermissions(['local-network-access']);
  const policy = readFileSync('deploy/cluster/nginx.conf', 'utf8').match(/add_header Content-Security-Policy "([^"]+)"/)[1].replaceAll('__DOMAIN__', new URL(baseURL).host);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || /Couldn't load texture|No se pudo cargar/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('red-horizon-v1', JSON.stringify({ options: { quality: 'low', volume: 0 } }));
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.effectiveDirective));
  });
  await page.route('**/*', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
  await page.goto('/?qa');
  await expect(page.locator('.model-loading')).toBeHidden({ timeout: 120000 });
  const textures = await page.evaluate(() => {
    const g = window.__RED_HORIZON__, report = {};
    for (const [name, root] of [['player', g.entities.avatar.root], ['environment', g.world.group]]) {
      const maps = new Set(); root.traverse(n => { for (const m of n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []) if (m.map) maps.add(m.map); });
      report[name] = { maps: maps.size, decoded: [...maps].every(t => t.image?.width > 0 && t.image?.height > 0) };
    }
    return report;
  });
  expect(textures.player.maps).toBeGreaterThan(0); expect(textures.environment.maps).toBeGreaterThan(0);
  expect(textures.player.decoded && textures.environment.decoded).toBe(true);
  const animation = await page.evaluate(async () => {
    const { OnlineGame } = await import('/src/network/OnlineGame.js');
    const g = window.__RED_HORIZON__;
    g.view.renderer.setAnimationLoop(null);
    const enemy = g.run.spawn('stalker', 0, -4); enemy.state = 'Chase';
    g.entities.sync(g.run);
    const mesh = g.entities.enemies.get(enemy.id); await mesh.userData.stalkerReady;
    const avatar = g.entities.stalkerAvatars.get(mesh);
    const online = new OnlineGame(g); g.online = online;
    const snapshot = time => ({ time, status: 'playing', players: [], enemies: [{ ...enemy }], projectiles: [], mission: { ...g.run.mission } });
    online.latest = snapshot(1.1); online.players = new Map();
    g.run.time = 1.1; const times = [];
    // Actual Game.render -> EntityViews -> enemy AnimationMixer, at 60 FPS,
    // while the same two 10 Hz server snapshots remain unchanged.
    for (let i = 0; i < 6; i++) {
      const now = performance.now(), elapsed = i * 1000 / 60;
      online.history = [{ at: now - 100 - elapsed, snapshot: snapshot(1) }, { at: now - elapsed, snapshot: online.latest }];
      g.render(1 / 60); times.push(avatar.clipTime);
    }
    return { times, authoritativeTime: g.run.time };
  });
  for (let i = 1; i < animation.times.length; i++) expect(animation.times[i]).toBeGreaterThan(animation.times[i - 1]);
  expect(animation.authoritativeTime).toBe(1.1);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});
