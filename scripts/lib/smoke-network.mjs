import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
export async function assertNoPublicClusterTraffic() {
  // Deliberately use normal DNS, never resolver(). The legacy address may already
  // proxy this cluster even before the owner changes DNS.
  const response = await fetch('https://redhorizon.lat/health', { signal: AbortSignal.timeout(10000) });
  if (!response.ok || typeof (await response.json()).connections === 'number') throw new Error('Refusing fault/load tests: public entry is unavailable or already uses the cluster');
}
export function resolver() {
  const ip = process.env.SMOKE_RESOLVE_IP;
  if (!ip) return undefined;
  if (!isIP(ip)) throw new Error('SMOKE_RESOLVE_IP must be an IP address');
  return (_host, options, callback) => options.all ? callback(null, [{ address: ip, family: isIP(ip) }]) : callback(null, ip, isIP(ip));
}
export function browserResolveArgs(url) {
  const ip = process.env.SMOKE_RESOLVE_IP; if (!ip) return [];
  if (!isIP(ip)) throw new Error('Invalid candidate IP');
  return [`--host-resolver-rules=MAP ${new URL(url).hostname} ${ip}`];
}
export function smokeFetch(url) {
  url = new URL(url);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, { lookup: resolver(), timeout: 10000 }, res => {
      const parts = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) res.destroy(new Error('Smoke response too large')); else parts.push(chunk); });
      res.on('error', reject); res.on('end', () => { const body = Buffer.concat(parts).toString(); resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, headers: res.headers, json: async () => JSON.parse(body), text: async () => body }); });
    }); req.on('timeout', () => req.destroy(new Error('Smoke timeout'))); req.on('error', reject);
  });
}
