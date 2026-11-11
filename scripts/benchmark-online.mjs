import { RoomManager } from '../server/RoomManager.js';
import { snapshot } from '../src/network/snapshot.js';
const manager = new RoomManager();
const socket = { send() {}, close() {} };
const { room, member } = manager.create(socket, 'Benchmark');
for (let i = 0; i < 3; i++) manager.join(room.code, socket, `Player ${i}`);
for (const m of room.members.values()) manager.ready(room, m, true);
manager.start(room, member); const r = room.run; r.director.timer = 1e9;
for (const m of r.members.values()) { m.player.stats.maxHp = 1e9; m.player.hp = 1e9; }
for (let i = 0; i < 59; i++) { const a = i / 59 * Math.PI * 2; r.spawn('stalker', Math.cos(a) * 30, Math.sin(a) * 30); }
const costs = [], serialization = []; let bytes = 0;
for (let i = 0; i < 3600; i++) {
  const start = performance.now(); manager.step(1 / 60); costs.push(performance.now() - start);
  if (i % 3 === 0) { const start = performance.now(), data = JSON.stringify(snapshot(room, Date.now())); serialization.push(performance.now() - start); bytes = Math.max(bytes, Buffer.byteLength(data)); }
}
const stats = values => { values.sort((a, b) => a - b); return { meanMs: values.reduce((a, b) => a + b) / values.length, p95Ms: values[Math.floor(values.length * .95)], maxMs: values.at(-1) }; };
console.log(JSON.stringify({ runtime: process.version, platform: `${process.platform}/${process.arch}`, scenario: 'one room, four players, 59 stalkers, 3600 fixed steps; no transport/rendering', simulation: stats(costs), serialization: stats(serialization), largestSnapshotBytes: bytes, note: 'Microbenchmark only; does not establish safe room capacity or WAN performance.' }, null, 2));
manager.close();
