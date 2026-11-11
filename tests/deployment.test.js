import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function decision({ runtime, entry = false } = {}) {
  const site = mkdtempSync(join(tmpdir(), 'rh-release-')); dirs.push(site);
  mkdirSync(join(site, 'current/runtime/server'), { recursive: true });
  writeFileSync(join(site, 'current/deployment.json'), JSON.stringify({ commit: 'revision' }));
  if (runtime) writeFileSync(join(site, 'current/runtime/release.json'), JSON.stringify({ commit: runtime }));
  if (entry) writeFileSync(join(site, 'current/runtime/server/main.js'), '');
  const script = readFileSync('deploy/ec2/deploy-main.sh', 'utf8').replace(/\r\n/g, '\n');
  const condition = script.slice(script.indexOf('if [ -f "$site/current/deployment.json"'), script.indexOf('  echo "Already deployed:'));
  return execFileSync('bash', ['-c', `${condition}echo skip; else echo build; fi`], { env: { ...process.env, site: site.replace(/\\/g, '/'), revision: 'revision' }, encoding: 'utf8' }).trim();
}
it('reconstruye una release estática aunque ya tenga el commit solicitado', () => { expect(decision()).toBe('build'); });
it('solo omite una release con manifiestos coincidentes y backend presente', () => { expect(decision({ runtime: 'revision', entry: true })).toBe('skip'); });
it('reconstruye un backend ausente o de otra revisión', () => {
  expect(decision({ runtime: 'revision' })).toBe('build');
  expect(decision({ runtime: 'previous', entry: true })).toBe('build');
});
