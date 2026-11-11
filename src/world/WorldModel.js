import { TerrainGenerator } from './TerrainGenerator.js';
import { Random } from '../utils/Random.js';

// Physics has its own random stream. Rendering cannot change collision or loot.
export class WorldModel {
  constructor(seed) {
    this.seed = seed; this.terrain = new TerrainGenerator(seed);
    this.obstacles = this.terrain.rocks.map((rock, i) => ({ ...rock, id: `rock-${i}` }));
    this.beacons = this.terrain.pois.map((site, i) => ({ ...site, id: `site-${i}`, z: site.z + 3, used: false }));
    for (const { x, z, type } of this.terrain.pois) {
      const solids = type === 'relay' ? [[-5, 0, 3.9], [3, -3, 0.6]] : type === 'ruin' ? [[-4, -3, 1.4], [4, -3, 1.4]] : [[4, -4, 4], [-4, -4, 3]];
      for (const [dx, dz, radius] of solids) this.obstacles.push({ id: `solid-${this.obstacles.length}`, x: x + dx, z: z + dz, radius });
    }
    this.rewards = []; const random = new Random(`${seed}-supplies`);
    for (let i = 0; i < 7; i++) {
      const a = random.range(0, Math.PI * 2), d = random.range(14, 65), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 2)) continue;
      this.rewards.push({ id: `supply-${i}`, x, z, used: false });
    }
  }
  heightAt(x, z) { return this.terrain.heightAt(x, z); }
}
