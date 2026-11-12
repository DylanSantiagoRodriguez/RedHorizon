import { test, expect } from '@playwright/test';
// Full Chromium supports native pointer lock; headless-shell rejects it on macOS.
test.use({ channel: 'chromium' });
const game = page => page.evaluate(() => {
  const g = window.__RED_HORIZON__, o = g.online;
  return { state: g.state.value, time: g.run.time, status: g.run.status, playerId: o?.playerId, count: o?.players.size, remoteViews: g.entities.remotePlayers.size, players: o ? [...o.players].map(([id, m]) => ({ id, x: m.player.x, z: m.player.z, hp: m.player.hp, maxHp: m.player.stats.maxHp })) : [], enemies: g.run.enemies.map(e => ({ id: e.id, hp: e.hp, dead: e.dead })), phase: g.run.mission.phase, kills: g.run.kills, gems: g.run.gems.length, connected: o?.connected, maxTaskMs: window.__TEST_MAX_TASK_MS__, connection: { state: o?.connectionState, error: o?.error, socketState: o?.connection.socket?.readyState, retries: o?.connection.attempt, closed: o?.connection.closed } };
});
async function fixture(request, code, action) { const response = await request.post(`http://127.0.0.1:18788/${action}?code=${code}`, { headers: { 'x-test-fixture': 'redhorizon-playwright' } }); expect(response.ok(), await response.text()).toBeTruthy(); }
test('dos contextos completan una expedición compartida y reconectan', async ({ browser, request }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]); const [a, b] = await Promise.all(contexts.map(c => c.newPage())); const errors = [];
  for (const p of [a, b]) p.on('pageerror', e => errors.push(e.message));
  try {
    for (const context of contexts) await context.addInitScript(() => {
      window.__TEST_MAX_TASK_MS__ = 0;
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__TEST_MAX_TASK_MS__ = Math.max(window.__TEST_MAX_TASK_MS__, entry.duration); }).observe({ type: 'longtask', buffered: true });
    });
    await Promise.all([a.goto('/?qa'), b.goto('/?qa')]);
    for (const p of [a, b]) await p.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.options.quality = 'low'; g.save.write(); g.applyOptions(); });
    await a.evaluate(() => { const g = window.__RED_HORIZON__; g.save.data.armor = 5; g.save.data.salvage = 99; g.save.write(); });
    for (const p of [a, b]) await p.getByRole('button', { name: 'Multijugador', exact: true }).click();
    await a.locator('#online-name').fill('Alfa'); await a.getByRole('button', { name: 'Crear sala', exact: true }).click();
    await expect(a.locator('#lobby-code')).toHaveText(/^[A-Z2-9]{6}$/); const code = await a.locator('#lobby-code').textContent();
    await b.locator('#online-name').fill('<Beta>'); await b.locator('#room-code').fill(` ${code.toLowerCase().slice(0, 3)} ${code.toLowerCase().slice(3)} `); await b.getByRole('button', { name: 'Unirse con código', exact: true }).click();
    await expect(a.locator('#lobby-players li')).toHaveCount(2); await expect(b.locator('#lobby-players')).toContainText('<Beta>');
    await a.getByRole('button', { name: 'Listo', exact: true }).click(); await b.getByRole('button', { name: 'Listo', exact: true }).click(); await expect(a.locator('#start-room')).toBeEnabled();
    await a.evaluate(() => { window.__PREPARED_WORLD__ = window.__RED_HORIZON__.world; });
    await a.locator('#start-room').click();
    await fixture(request, code, 'explore');
    await expect.poll(async () => (await game(a)).count).toBe(2); await expect.poll(async () => (await game(b)).remoteViews).toBe(1);
    expect(await a.evaluate(() => window.__PREPARED_WORLD__ === window.__RED_HORIZON__.world && !window.__RED_HORIZON__.loading.pending)).toBe(true);
    for (const page of [a, b]) {
      await expect.poll(() => page.evaluate(() => !!window.__RED_HORIZON__.world.environmentLoaded), { timeout: 180000 }).toBe(true);
      expect(await page.evaluate(() => {
        let max = 0;
        window.__RED_HORIZON__.world.group.traverse(node => {
          for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [])
            for (const texture of Object.values(material)) if (texture?.isTexture) max = Math.max(max, texture.image?.width || 0, texture.image?.height || 0);
        });
        return max;
      })).toBeLessThanOrEqual(1024);
    }
    const initial = await game(a), id = initial.playerId; expect(initial.players.find(p => p.id === id).maxHp).toBe(120);
    await a.keyboard.down('KeyW'); await expect.poll(async () => (await game(b)).players.find(p => p.id === id)?.z).toBeLessThan(-1); await a.keyboard.up('KeyW');
    await a.keyboard.press('Escape'); await expect.poll(async () => (await game(a)).state).toBe('paused'); const before = (await game(b)).time; await expect.poll(async () => (await game(b)).time).toBeGreaterThan(before + .5);
    await a.locator('#resume').click(); await fixture(request, code, 'upgrade');
    await b.bringToFront(); await b.locator('[data-upgrade]').first().click();
    await a.bringToFront(); await a.locator('[data-upgrade]').first().click();
    await expect.poll(() => a.evaluate(() => document.pointerLockElement === window.__RED_HORIZON__.input.canvas)).toBe(true);
    await expect.poll(async () => (await game(a)).state).toBe('playing');
    expect(await a.evaluate(() => document.pointerLockElement === window.__RED_HORIZON__.input.canvas)).toBe(true);
    // Release capture for subsequent automation; this remains an explicit local pause.
    await a.keyboard.press('Escape'); await a.locator('#resume').click();
    await fixture(request, code, 'combat');
    // Fire through the same input path used by the remappable HUD, without relying on pointer-lock permissions in headless Chrome.
    await a.evaluate(() => { const g = window.__RED_HORIZON__; g.camera.yaw = 0; g.camera.pitch = 0; g.input.buttons.add(0); });
    await expect.poll(async () => (await game(b)).enemies[0]?.hp ?? 0).toBeLessThan(100);
    await a.evaluate(() => window.__RED_HORIZON__.input.buttons.delete(0));
    const shared = (await game(a)).enemies[0]?.id; if (shared) expect((await game(b)).enemies[0].id).toBe(shared);
    await contexts[0].setOffline(true); await expect.poll(async () => (await game(b)).time).toBeGreaterThan(before + 1); await a.evaluate(() => window.__RED_HORIZON__.online.connection.socket.close());
    await contexts[0].setOffline(false); await expect.poll(async () => (await game(a)).connected).toBe(true); expect((await game(a)).playerId).toBe(id); expect((await game(b)).count).toBe(2);
    // A reload also recovers the identity from tab-scoped sessionStorage.
    await a.reload({ waitUntil: 'domcontentloaded' }); await expect.poll(async () => (await game(a)).count).toBe(2); expect((await game(a)).playerId).toBe(id);
    // Reconnection precedes model loading; controls stay neutral until the scene is ready.
    await expect(a.locator('.model-loading')).toBeHidden({ timeout: 180000 });
    await expect.poll(() => a.evaluate(() => !!window.__RED_HORIZON__.world.environmentLoaded), { timeout: 180000 }).toBe(true);
    await expect.poll(async () => (await game(a)).connected).toBe(true);
    expect(await a.evaluate(() => {
      const overview = document.querySelector('.online-overview').getBoundingClientRect();
      const vitals = document.querySelector('.online-sidebar .vitals').getBoundingClientRect();
      const team = document.querySelector('.online-team').getBoundingClientRect();
      const mission = document.querySelector('.online-sidebar .mission').getBoundingClientRect();
      return overview.bottom <= vitals.top && team.bottom <= mission.top;
    })).toBe(true);
    await fixture(request, code, 'mission');
    for (const page of [a, b]) await expect.poll(() => page.evaluate(() => {
      const g = window.__RED_HORIZON__;
      return [...g.entities.enemies.values()].filter(mesh => {
        const avatar = g.entities.animatedAvatar(mesh); if (!avatar || !mesh.userData.modelKey.startsWith('titan-')) return false;
        mesh.updateMatrixWorld(true); let valid = mesh.visible && avatar.root.visible, meshes = 0;
        avatar.root.traverse(node => { if (node.isMesh) { meshes++; valid &&= node.matrixWorld.elements.every(Number.isFinite); if (node.skeleton) { node.skeleton.update(); valid &&= [...node.skeleton.boneMatrices].every(Number.isFinite); } } });
        return valid && meshes > 0;
      }).length;
    })).toBe(5);
    await a.keyboard.press('KeyQ'); await expect.poll(async () => (await game(b)).gems).toBe(5);
    await fixture(request, code, 'launch-position'); await expect.poll(async () => (await game(b)).phase).toBe('ready');
    // The second player may launch the team's beacon.
    await b.bringToFront();
    if ((await game(b)).state === 'paused') await b.locator('#resume').click();
    // 'ready' may already be visible before the fixture moves the team. Wait
    // for its authoritative position and the end of queued upgrade transitions
    // before sending the one-shot interaction.
    await expect.poll(() => b.evaluate(() => {
      const g = window.__RED_HORIZON__;
      return g.state.value === 'playing' && g.online.connected && g.run.player.z > 6 && g.run.interaction?.id === g.run.launchBeacon.id;
    })).toBe(true);
    await b.keyboard.press('KeyE'); await expect.poll(async () => (await game(a)).phase).toBe('countdown');
    await fixture(request, code, 'finale'); await expect.poll(async () => (await game(a)).phase).toBe('cinematic'); await fixture(request, code, 'epilogue');
    await expect.poll(async () => (await game(a)).state).toBe('victory'); await expect.poll(async () => (await game(b)).state).toBe('victory');
    console.log('QA longest browser tasks (ms)', (await game(a)).maxTaskMs, (await game(b)).maxTaskMs);
    expect(await a.evaluate(() => ({ armor: window.__RED_HORIZON__.save.data.armor, salvage: window.__RED_HORIZON__.save.data.salvage }))).toEqual({ armor: 5, salvage: 99 });
    await a.locator('#menu').click(); await expect(a.locator('#multiplayer')).toBeVisible(); expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});


test('permite reintentar una conexión inicial fallida sin anunciar una sala expirada', async ({ page, context }) => {
  await page.goto('/?qa'); await page.getByRole('button', { name: 'Multijugador', exact: true }).click();
  await context.setOffline(true); await page.locator('#create-room').click();
  await expect(page.locator('#online-status')).toContainText('No se pudo conectar con el servidor multijugador');
  await expect(page.locator('#online-status')).not.toContainText('reconexión ha terminado');
  await context.setOffline(false); await page.locator('#create-room').click();
  await expect(page.locator('#lobby-code')).toHaveText(/^[A-Z2-9]{6}$/);
  await page.locator('#leave-room').click();
});
