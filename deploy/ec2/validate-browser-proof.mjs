import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validProof(proof, stat, revision, now = Date.now()) {
  return stat.uid === 0 && !(stat.mode & 0o022) && proof.version === 1 && proof.commit === revision &&
    Number.isFinite(proof.validatedAt) && now - proof.validatedAt >= -60000 && now - proof.validatedAt < 86400000 &&
    Array.isArray(proof.checks) && ['check', 'integration', 'online', 'production-smoke'].every(check => proof.checks.includes(check));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!validProof(JSON.parse(readFileSync(process.argv[2], 'utf8')), statSync(process.argv[2]), process.argv[3])) process.exitCode = 1;
  } catch { process.exitCode = 1; }
}
