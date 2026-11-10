import { CONFIG } from '../config.js';
export function moveCircle(body, dx, dz, obstacles, radius = body.radius) {
  body.x += dx; body.z += dz;
  for (let pass = 0; pass < 3; pass++) for (const o of obstacles) {
    const x = body.x - o.x, z = body.z - o.z, d = Math.hypot(x, z), min = radius + o.radius;
    if (d < min) {
      body.x += (d > 0.001 ? x / d : 1) * (min - d);
      body.z += (d > 0.001 ? z / d : 0) * (min - d);
    }
  }
  const d = Math.hypot(body.x, body.z), max = CONFIG.mapRadius - radius;
  if (d > max) { body.x *= max / d; body.z *= max / d; }
}
export function segmentHit(ax, ay, az, bx, by, bz, cx, cy, cz, radius) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / length)) : 0;
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy, az + dz * t - cz) <= radius;
}
