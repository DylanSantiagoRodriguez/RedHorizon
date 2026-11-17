// Generate initial local panel access. No passwords, TOTP seeds or keys on stdout.
import { mkdirSync, writeFileSync, realpathSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { TOTP, Secret } from 'otpauth';
import { passwordHash } from '../../server/observability/auth.js';
const root = '/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon';
const directory = resolve(process.argv[2] || '');
if (!directory.startsWith(root + '/')) throw new Error('Use a new directory inside the approved key directory');
mkdirSync(directory, { recursive: false, mode: 0o700 }); if (!realpathSync(directory).startsWith(realpathSync(root) + '/')) throw new Error('Unsafe path'); chmodSync(directory, 0o700);
const users = {}, enrollment = {};
for (const role of ['admin', 'reader']) {
 const password = randomBytes(24).toString('base64url'), secret = new Secret({ size: 20 });
 users[role] = { role, ...await passwordHash(password), totpSecret: secret.base32 };
 enrollment[role] = { username: role, password, enrollmentURI: new TOTP({ issuer: 'Red Horizon', label: role, secret }).toString() };
}
writeFileSync(directory + '/users.json', JSON.stringify(users), { mode: 0o600, flag: 'wx' });
writeFileSync(directory + '/enrollment.json', JSON.stringify(enrollment, null, 2), { mode: 0o600, flag: 'wx' });
console.log('Access files created in the approved directory. Enroll the TOTP locally; never upload enrollment.json.');
