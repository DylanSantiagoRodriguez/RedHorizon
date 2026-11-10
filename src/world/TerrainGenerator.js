import { Random } from '../utils/Random.js';
export class TerrainGenerator {
  constructor(seed) {
    this.random = new Random(seed); this.size = 240; this.segments = 120; this.spacing = 2;
    this.phase = this.random.range(0, Math.PI * 2);
    this.craters = Array.from({ length: 5 }, () => ({ x: this.random.range(-70, 70), z: this.random.range(-70, 70), radius: this.random.range(8, 16) }));
    this.heights = new Float32Array((this.segments + 1) ** 2);
    for (let z = 0; z <= this.segments; z++) for (let x = 0; x <= this.segments; x++) this.heights[z * (this.segments + 1) + x] = this.rawHeight(x * 2 - 120, z * 2 - 120);
    this.pois = [{ x: 0, z: -32, type: 'relay', name: 'Relé Aster' }, { x: -38, z: -8, type: 'ruin', name: 'Archivo perdido' }, { x: 36, z: 18, type: 'wreck', name: 'Naufragio Ícaro' }];
    this.rocks = [];
    for (let i = 0; i < 200; i++) {
      const angle = this.random.range(0, Math.PI * 2), distance = this.random.range(12, 88);
      const rock = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, radius: this.random.range(0.8, 3.3), height: this.random.range(1.5, 5), rotation: this.random.range(0, Math.PI) };
      if (this.pois.some(p => Math.hypot(p.x - rock.x, p.z - rock.z) < 10 + rock.radius)) continue;
      if (this.rocks.some(p => Math.hypot(p.x - rock.x, p.z - rock.z) < p.radius + rock.radius + 3)) continue;
      this.rocks.push(rock);
    }
  }
  rawHeight(x, z) {
    const flatten = Math.min(1, Math.hypot(x, z) / 14);
    let h = Math.sin(x * 0.046 + this.phase) * Math.cos(z * 0.038) * 2.4 + Math.sin((x + z) * 0.105 + this.phase) * 0.7;
    for (const c of this.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.radius;
      h += -2.1 * Math.exp(-d * d * 3) + 0.9 * Math.exp(-(((d - 1) * 5) ** 2));
    }
    return h * flatten;
  }
  // Same two triangles as PlaneGeometry, avoiding visible feet/ground mismatch.
  heightAt(x, z) {
    const u = Math.max(0, Math.min(this.segments - 0.001, (x + 120) / 2));
    const v = Math.max(0, Math.min(this.segments - 0.001, (z + 120) / 2));
    const ix = Math.floor(u), iz = Math.floor(v), fx = u - ix, fz = v - iz, n = this.segments + 1;
    const a = this.heights[iz * n + ix], b = this.heights[iz * n + ix + 1], c = this.heights[(iz + 1) * n + ix], d = this.heights[(iz + 1) * n + ix + 1];
    return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }
}
