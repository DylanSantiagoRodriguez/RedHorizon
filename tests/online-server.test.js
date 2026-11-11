import { it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../server/server.js';
import { PROTOCOL_VERSION, GAME_VERSION } from '../src/network/protocol.js';
const apps = [], sockets = [];
afterEach(async () => { for (const s of sockets.splice(0)) s.terminate(); for (const a of apps.splice(0)) await a.close(); });
async function boot(options) { const a = createServer({ port: 0, ...options }); apps.push(a); const addr = await a.listen(); return { app: a, url: `ws://127.0.0.1:${addr.port}/ws`, port: addr.port }; }
async function connect(url, origin = 'http://127.0.0.1:5173') {
  const s = new WebSocket(url, { origin }); sockets.push(s); s.messages = []; s.on('message', data => s.messages.push(JSON.parse(data))); await new Promise((resolve, reject) => { s.once('open', resolve); s.once('error', reject); }); return s;
}
const send = (s, m) => s.send(JSON.stringify(m));
const hello = type => ({ type, version: PROTOCOL_VERSION, gameVersion: GAME_VERSION });
async function message(s, type) { await expect.poll(() => s.messages.some(m => m.type === type)).toBe(true); return s.messages.find(m => m.type === type); }
it('WebSocket real: aislamiento, versión, autoridad y salud', async () => {
  const { app, url, port } = await boot(); const a = await connect(url), b = await connect(url), c = await connect(url);
  send(a, hello('create')); const wa = await message(a, 'welcome'); send(b, { ...hello('join'), code: wa.code }); const wb = await message(b, 'welcome'); send(c, hello('create')); const wc = await message(c, 'welcome'); expect(wc.code).not.toBe(wa.code);
  send(b, { type: 'start' }); expect((await message(b, 'error')).code).toBe('PERMISSION');
  send(a, { type: 'ready', ready: true }); send(b, { type: 'ready', ready: true }); await expect.poll(() => app.manager.find(wa.code).members.get(wb.playerId).ready).toBe(true); send(a, { type: 'start' });
  await message(a, 'snapshot'); await message(b, 'snapshot'); expect(c.messages.some(m => m.type === 'snapshot')).toBe(false);
  const bad = await connect(url); send(bad, { ...hello('create'), version: 999 }); expect((await message(bad, 'error')).code).toBe('VERSION');
  const oldWorld = await connect(url); send(oldWorld, { ...hello('create'), gameVersion: 'coop-1' }); expect((await message(oldWorld, 'error')).code).toBe('VERSION');
  send(a, { type: 'input', playerId: wb.playerId, x: 999 }); expect((await message(a, 'error')).code).toBe('INVALID');
  const health = await fetch(`http://127.0.0.1:${port}/health`).then(r => r.json()); expect(health.protocol).toBe(PROTOCOL_VERSION);
});
it('reconexión real conserva playerId y snapshot completo', async () => {
  const { app, url } = await boot(); const a = await connect(url); send(a, hello('create')); const w = await message(a, 'welcome'); a.close(); await expect.poll(() => app.manager.find(w.code).members.get(w.playerId).socket).toBeNull();
  const b = await connect(url); send(b, { ...hello('reconnect'), code: w.code, token: w.token }); const recovered = await message(b, 'welcome'); expect(recovered.playerId).toBe(w.playerId); expect(app.manager.find(w.code).members.size).toBe(1);
});
it('rechaza Origin ajeno, mensajes malformados y payload excesivo sin caer', async () => {
  const { url, port } = await boot(); await expect(connect(url, 'https://evil.invalid')).rejects.toThrow(); const s = await connect(url); s.send('{bad'); expect((await message(s, 'error')).code).toBe('INVALID');
  s.send('x'.repeat(5000)); await expect.poll(() => s.readyState).toBe(WebSocket.CLOSED); expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
});
it('cierre controlado avisa y libera sockets, salas y puerto', async () => {
  const { app, url } = await boot(); const s = await connect(url); send(s, hello('create')); await message(s, 'welcome'); await app.close(); expect(s.messages.some(m => m.type === 'shutdown')).toBe(true); expect(app.manager.rooms.size).toBe(0); expect(app.clients.size).toBe(0);
});
it('aplica límites de frecuencia, conexiones y clientes lentos', async () => {
  const { app, url } = await boot({ perIp: 1, maxBuffered: 1 }); const s = await connect(url); await expect(connect(url)).rejects.toThrow(); send(s, hello('create')); const w = await message(s, 'welcome');
  const serverSocket = app.manager.find(w.code).members.get(w.playerId).socket; Object.defineProperty(serverSocket, 'bufferedAmount', { value: 20 }); app.manager.broadcastLobby(app.manager.find(w.code)); await expect.poll(() => s.readyState).toBe(WebSocket.CLOSED);
  const second = await connect(url); for (let i = 0; i < 151; i++) send(second, { type: 'ping', at: 0 }); await expect.poll(() => second.readyState).toBe(WebSocket.CLOSED); expect(second.messages.some(m => m.code === 'LIMIT')).toBe(true);
});
