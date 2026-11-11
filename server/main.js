import { readFile } from 'node:fs/promises';
import { createServer } from './server.js';
const number = (name, fallback) => { const value = Number(process.env[name] ?? fallback); if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuración inválida: ${name}`); return value; };
if (process.env.NODE_ENV === 'production' && !process.env.WS_ORIGINS) throw new Error('WS_ORIGINS es obligatorio en producción');
let buildId; try { buildId = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8')).commit; } catch { /* Development has no release manifest. */ }
const app = createServer({ buildId, port: number('PORT', 8787), origins: process.env.WS_ORIGINS?.split(',').map(s => s.trim()), tickHz: number('TICK_HZ', 60), snapshotHz: number('SNAPSHOT_HZ', 20), maxRooms: number('MAX_ROOMS', 64), maxConnections: number('MAX_CONNECTIONS', 256), perIp: number('MAX_CONNECTIONS_PER_IP', 12), maxBuffered: number('MAX_BUFFERED_BYTES', 1048576), healthPerPlayer: number('HEALTH_PER_PLAYER', .65), trustProxy: process.env.TRUST_PROXY === '1' });
const address = await app.listen(); console.log(`Red Horizon backend: http://127.0.0.1:${address.port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
