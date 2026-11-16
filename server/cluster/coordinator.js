import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { createClient } from 'redis';
import { CODE_ALPHABET } from '../../src/network/protocol.js';
import { jsonBody, jsonReply, peer } from './transport.js';
const script = readFileSync(new URL('./directory.lua', import.meta.url), 'utf8');
const codeOK = code => typeof code === 'string' && code.length === 6 && [...code].every(c => CODE_ALPHABET.includes(c));
export async function createCoordinator({ tls, redisUrl = 'redis://127.0.0.1:6379', workers, key = 'rh:directory:v1', host = '127.0.0.1', port = 8443 }) {
  if (!workers.length || workers.some(w => !/^rh-game-0[123]$/.test(w))) throw new Error('Invalid worker allowlist');
  const redis = createClient({ url: redisUrl, disableOfflineQueue: true, socket: { connectTimeout: 2000, reconnectStrategy: retries => Math.min(1000, 100 * retries) } });
  redis.on('error', () => {}); await redis.connect();
  const execute = async (op, args) => JSON.parse(await redis.eval(script, { keys: [key], arguments: [op, JSON.stringify(args)] }));
  const server = https.createServer({ ...tls, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, async (req, res) => {
    const identity = peer(req);
    try {
      if (req.method !== 'POST') return jsonReply(res, 405, { error: 'INVALID' });
      if (identity !== 'rh-gateway' && !workers.includes(identity)) return jsonReply(res, 403, { error: 'PERMISSION' });
      const a = await jsonBody(req);
      let result;
      if (req.url === '/reserve' && identity === 'rh-gateway') {
        for (let i = 0; i < 5; i++) {
          const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
          result = await execute('reserve', { code, token: randomBytes(32).toString('hex') });
          if (result.error !== 'COLLISION') break;
        }
      } else if (req.url === '/lookup' && identity === 'rh-gateway' && codeOK(a.code)) result = await execute('lookup', { code: a.code });
      else if (req.url === '/heartbeat' && workers.includes(identity) && /^[a-f0-9-]{36}$/.test(a.boot) && Number.isInteger(a.capacity) && a.capacity >= 0 && a.capacity <= 256 && typeof a.draining === 'boolean' && Number.isFinite(a.load) && a.load >= 0 && Array.isArray(a.rooms) && a.rooms.length <= 256 && a.rooms.every(codeOK)) result = await execute('heartbeat', { ...a, id: identity });
      else if (req.url === '/activate' && workers.includes(identity) && codeOK(a.code) && /^[a-f0-9]{64}$/.test(a.token) && /^[a-f0-9-]{36}$/.test(a.boot)) result = await execute('activate', { ...a, id: identity });
      else return jsonReply(res, 400, { error: 'INVALID' });
      jsonReply(res, result.error ? 503 : 200, result);
    } catch { if (!res.headersSent) jsonReply(res, 503, { error: 'UNAVAILABLE' }); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 64;
  return { server, redis, execute, listen: () => new Promise(resolve => server.listen(port, host, () => resolve(server.address()))), close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); redis.destroy(); } };
}
