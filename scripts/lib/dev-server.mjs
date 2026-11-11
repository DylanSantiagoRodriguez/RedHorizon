import { createServer as createViteServer } from 'vite';
import { createServer as createGameServer } from '../../server/server.js';

// Resolve Vite's actual port before authorizing the browser Origin. A fallback
// from 5173 to 5174 must not leave the game server expecting the original port.
export async function startDevelopment({ host = '127.0.0.1', port = 5173, strictPort = false, backendPort = Number(process.env.RH_BACKEND_PORT || process.env.PORT || 8787), origins = process.env.WS_ORIGINS?.split(',').map(s => s.trim()), logLevel = 'info', mode = 'development', open = false } = {}) {
  if (!Number.isInteger(backendPort) || backendPort < 0 || backendPort > 65535) throw new Error('Puerto del backend inválido');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Puerto del frontend inválido');
  const proxy = { '/ws': { target: `http://127.0.0.1:${backendPort}`, ws: true }, '/health': { target: `http://127.0.0.1:${backendPort}` } };
  const vite = await createViteServer({ mode, logLevel, clearScreen: false, server: { host, port, strictPort, open: false, proxy } });
  let backend;
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    // Close WebSockets through the backend before tearing down their proxy.
    try { await backend?.close(); } finally { await vite.close(); }
  };
  try {
    await vite.listen();
    const urls = [...(vite.resolvedUrls?.local || []), ...(vite.resolvedUrls?.network || [])];
    const allowed = new Set(urls.map(url => new URL(url).origin));
    for (const origin of [...allowed]) {
      const url = new URL(origin);
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost'; allowed.add(url.origin);
      }
    }
    backend = createGameServer({ port: backendPort, origins: origins || [...allowed] });
    const address = await backend.listen();
    // The proxy object is already installed by vite.config.js. Updating its
    // shared options also supports an ephemeral backend port in regression tests.
    const target = `http://127.0.0.1:${address.port}`;
    proxy['/ws'].target = target; proxy['/health'].target = target;
    vite.config.server.proxy['/ws'].target = target;
    vite.config.server.proxy['/health'].target = target;
    if (open) { vite.config.server.open = open; vite.openBrowser(); }
    return { vite, backend, address, urls, close };
  } catch (error) { await close(); throw error; }
}
