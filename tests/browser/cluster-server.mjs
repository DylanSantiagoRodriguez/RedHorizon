// Test-only entry point. Never included in release packages.
import http from 'node:http';
import { harness } from '../cluster/harness.js';
const h = await harness({ origin: 'http://127.0.0.1:5181', gatewayPort: 18789 });
const heartbeat = setInterval(() => { for (const w of h.workers) w.report().catch(() => {}); }, 5000);
const control = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.headers['x-test-fixture'] !== 'redhorizon-playwright') return res.writeHead(403).end();
  if (req.url === '/coordinator-off') { h.coord.redis.destroy(); res.end('ok'); }
  else res.writeHead(404).end();
});
await new Promise(resolve => control.listen(18790, '127.0.0.1', resolve));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { clearInterval(heartbeat); control.close(); if (!h.coord.redis.isOpen) await h.coord.redis.connect(); await h.close(); process.exit(0); });
