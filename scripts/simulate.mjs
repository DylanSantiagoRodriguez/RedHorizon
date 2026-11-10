import { Run } from '../src/core/Run.js';
import { TerrainGenerator } from '../src/world/TerrainGenerator.js';
import { mkdir, writeFile } from 'node:fs/promises';
// Deterministic QA pilot: perfect aim and knowledge of threats, normal health/damage.
// This measures mechanical reachability, not human balance or playability comfort.
const reports = [];
for (const seed of ['ASTER-09', 'RED-2026', 'DUST-42']) {
  const terrain = new TerrainGenerator(seed), world = { heightAt: (x, z) => terrain.heightAt(x, z), obstacles: terrain.rocks, beacons: [], rewards: [] };
  const run = new Run(world, seed); run.weapon.equipped = 'nova'; run.autoFire = true;
  const priorities = ['multishot', 'explosion', 'lifesteal', 'damage', 'fireRate', 'regen', 'shield', 'crit', 'area', 'maxHp', 'cooldown', 'critDamage', 'bounce', 'pierce', 'speed'];
  let tick = 0, minHp = 120, maxEnemies = 0;
  while (tick++ < 60 * 720 && !['victory', 'defeat'].includes(run.status)) {
    if (run.status === 'upgrade') { const choice = [...run.upgrades.offers].sort((a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id))[0]; run.chooseUpgrade(choice.id); continue; }
    const p = run.player;
    let nearest = null, distance = Infinity;
    for (const e of run.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < distance) { nearest = e; distance = d; } }
    // Prioritize the mission objective after arrival instead of farming an
    // endless stream of nearby enemies. No player or boss stats are changed.
    if (run.boss.enemy && !run.boss.enemy.dead && distance > 3) nearest = run.boss.enemy;
    const angle = run.time * 0.25, tx = Math.sin(angle) * 30, tz = Math.cos(angle) * 30;
    const yaw = Math.atan2(tx - p.x, -(tz - p.z));
    let aim = { x: 0, y: 0, z: -1 };
    if (nearest) { const x = nearest.x - p.x, y = nearest.y - p.y - 1.45, z = nearest.z - p.z, n = Math.hypot(x, y, z); aim = { x: x / n, y: y / n, z: z / n }; }
    const input = { down: key => key === 'KeyW' || key === 'ShiftLeft', take: key => key === 'KeyQ' ? distance < 8 : key === 'Space' && distance < 5 && tick % 70 === 0, buttons: new Set() };
    run.update(1 / 60, input, yaw, aim); minHp = Math.min(minHp, p.hp); maxEnemies = Math.max(maxEnemies, run.enemies.length);
  }
  reports.push({ seed, status: run.status, seconds: +run.time.toFixed(1), kills: run.kills, level: run.level, health: +run.player.hp.toFixed(1), minHp: +minHp.toFixed(1), maxEnemies, bossSpawned: run.boss.spawned, bossHp: run.boss.enemy?.hp ?? null, upgrades: run.upgrades.stacks });
}
await mkdir('docs/qa', { recursive: true }); await writeFile('docs/qa/simulation.json', JSON.stringify({ method: 'QA bot, perfect aim, normal stats, seeded rocky terrain, no relay acceleration or healing crates', reports }, null, 2));
console.log(JSON.stringify(reports, null, 2));
