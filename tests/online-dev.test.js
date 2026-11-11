import http from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startDevelopment } from '../scripts/lib/dev-server.mjs';
import { PROTOCOL_VERSION, GAME_VERSION } from '../src/network/protocol.js';
const cleanups = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });
async function occupiedPort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => server.close(resolve))); return server.address().port;
}
function join(url, origin) {
  const socket = new WebSocket(url, { origin }); cleanups.push(() => socket.terminate());
  return new Promise((resolve, reject) => { socket.once('error', reject); socket.once('open', () => resolve(socket)); });
}
it('arranca ambos servicios y usa el puerto real de Vite cuando el solicitado está ocupado', async () => {
  const requested = await occupiedPort();
  const app = await startDevelopment({ port: requested, backendPort: 0, logLevel: 'silent' }); cleanups.push(() => app.close());
  const port = app.vite.httpServer.address().port;
  expect(port).toBeGreaterThan(requested);
  const origin = `http://127.0.0.1:${port}`;
  expect((await fetch(`${origin}/health`).then(r => r.json())).ok).toBe(true);
  const socket = await join(`ws://127.0.0.1:${port}/ws`, origin);
  const welcome = new Promise(resolve => socket.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'welcome') resolve(m); }));
  socket.send(JSON.stringify({ type: 'create', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION }));
  expect((await welcome).code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await expect(join(`ws://127.0.0.1:${app.address.port}/ws`, `http://127.0.0.1:${requested}`)).rejects.toThrow();
  socket.terminate(); await app.close();
  await expect(fetch(`${origin}/health`)).rejects.toThrow();
}, 20000);
it('rechaza un backend ocupado y limpia el frontend iniciado', async () => {
  const backendPort = await occupiedPort();
  await expect(startDevelopment({ port: 0, backendPort, logLevel: 'silent' })).rejects.toMatchObject({ code: 'EADDRINUSE' });
}, 20000);
it('conserva una lista explícita de orígenes sin ampliar sus permisos', async () => {
  const app = await startDevelopment({ port: 0, backendPort: 0, origins: ['https://configured.example'], logLevel: 'silent' }); cleanups.push(() => app.close());
  const origin = `http://127.0.0.1:${app.vite.httpServer.address().port}`;
  await expect(join(`ws://127.0.0.1:${app.address.port}/ws`, origin)).rejects.toThrow();
  const socket = await join(`ws://127.0.0.1:${app.address.port}/ws`, 'https://configured.example'); socket.terminate();
}, 20000);
