import { spawn } from 'node:child_process';
const processes = [spawn(process.execPath, ['server/main.js'], { stdio: 'inherit' }), spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', ...process.argv.slice(2)], { stdio: 'inherit' })];
let closing = false;
const close = () => { if (closing) return; closing = true; for (const p of processes) p.kill('SIGTERM'); };
for (const p of processes) p.on('exit', close);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, close);
