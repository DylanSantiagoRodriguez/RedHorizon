import { parseArgs } from 'node:util';
import { startDevelopment } from './lib/dev-server.mjs';

const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '5173' }, strictPort: { type: 'boolean', default: false }, mode: { type: 'string', default: 'development' }, open: { type: 'boolean', default: false } } });
try {
  const app = await startDevelopment({ ...values, port: Number(values.port) });
  console.log(`Red Horizon backend: http://127.0.0.1:${app.address.port}`);
  app.vite.printUrls();
  app.vite.bindCLIShortcuts({ print: true, customShortcuts: [{ key: 'q', description: 'cerrar frontend y backend', action: async () => { await app.close(); process.exit(0); } }] });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? 'El puerto del backend está ocupado. Cierra la instancia anterior o usa npm run dev:frontend para conectarte a un backend que ya esté activo.' : error.message);
  process.exitCode = 1;
}
