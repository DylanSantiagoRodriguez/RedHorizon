import https from 'node:https';
import { readFileSync } from 'node:fs';
export function tlsFiles(dir, name) {
  return { ca: readFileSync(`${dir}/ca.crt`), cert: readFileSync(`${dir}/${name}.crt`), key: readFileSync(`${dir}/${name}.key`) };
}
export function peer(req) { return req.socket.authorized ? req.socket.getPeerCertificate().subject?.CN : null; }
export function apiClient(base, tls, telemetry = null) {
  const url = new URL(base);
  if (url.protocol !== 'https:') throw new Error('Cluster API requires HTTPS');
  const agent = new https.Agent({ ...tls, keepAlive: true, maxSockets: 8, rejectUnauthorized: true });
  const call = (path, body) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    telemetry?.metrics.inc('rh_coordinator_request_bytes_total', Buffer.byteLength(data), { peer: 'rh-coordinator' });
    telemetry?.metrics.inc('rh_coordinator_requests_total');
    const req = https.request(new URL(path, url), { method: 'POST', agent, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 3000 }, res => {
      let result = ''; res.on('data', c => { telemetry?.metrics.inc('rh_coordinator_response_bytes_total', c.length, { peer: 'rh-coordinator' }); result += c; if (result.length > 65536) res.destroy(new Error('Oversized API response')); });
      res.on('error', reject); res.on('end', () => { try { const parsed = JSON.parse(result); if (res.statusCode !== 200) { const error = new Error('Coordinator rejected operation'); error.code = parsed.error || 'UNAVAILABLE'; reject(error); } else resolve(parsed); } catch (error) { reject(error); } });
    });
    req.on('timeout', () => req.destroy(new Error('Coordinator timeout'))); req.on('error', reject); req.end(data);
  });
  call.close = () => agent.destroy(); return call;
}
export async function jsonBody(req, limit = 16384) {
  let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > limit) throw new Error('Body too large'); }
  return JSON.parse(body);
}
export function jsonReply(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
