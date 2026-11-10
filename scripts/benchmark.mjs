import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://127.0.0.1:5173/?qa'); await page.locator('#seed').fill('BENCHMARK'); await page.locator('#start').click();
const results = [];
for (const quality of ['high', 'low']) {
  await page.evaluate(q => {
    const g = window.__RED_HORIZON__; g.save.data.options.quality = q; g.applyOptions(); g.run.director.timer = 999; g.run.player.invulnerable = 999;
    if (!g.run.enemies.length) for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; const e = g.run.spawn(['stalker', 'brute', 'drone', 'spitter'][i % 4], Math.sin(a) * 24, Math.cos(a) * 24); e.speed = 0; e.range = 0; }
  }, quality);
  await page.waitForTimeout(1500);
  results.push(await page.evaluate(async quality => {
    const times = []; let previous = performance.now(); const start = previous;
    await new Promise(resolve => { function sample(now) { times.push(now - previous); previous = now; if (now - start < 6000) requestAnimationFrame(sample); else resolve(); } requestAnimationFrame(sample); });
    times.shift(); times.sort((a, b) => a - b);
    const g = window.__RED_HORIZON__, gl = g.view.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { quality, resolution: '1920x1080', enemies: g.run.enemies.length, samples: times.length, meanFps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1), p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), drawCalls: g.view.renderer.info.render.calls, triangles: g.view.renderer.info.render.triangles, geometries: g.view.renderer.info.memory.geometries, textures: g.view.renderer.info.memory.textures };
  }, quality));
}
await mkdir('docs/qa', { recursive: true }); await writeFile('docs/qa/benchmark.json', JSON.stringify({ environment: 'Chromium headless, equipo local, sin publicación', results }, null, 2));
console.log(JSON.stringify(results, null, 2)); await browser.close();
