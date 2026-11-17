import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { TOTP } from 'otpauth';
import { Limiter } from '../cluster/limiter.js';
const derive = promisify(scrypt);
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) { return { salt, hash: (await derive(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 })).toString('hex') }; }
export class Auth {
  constructor(users, store, { now = Date.now } = {}) {
    if (!Object.keys(users).length || Object.values(users).some(u => !['reader', 'admin'].includes(u.role) || !u.totpSecret || !/^[a-f0-9]{64}$/.test(u.hash))) throw new Error('MFA users required');
    Object.assign(this, { users, store, now }); this.sessions = new Map(); this.limiter = new Limiter(1024, now); this.busy = 0;
  }
  async login(username, password, token, ip) {
    this.sweep();
    if (this.busy >= 4 || this.sessions.size >= 128 || !this.limiter.take('global', 20, .5) || !this.limiter.take(ip, 5, 5 / 60)) return null;
    if (typeof password !== 'string' || password.length > 256 || typeof username !== 'string' || username.length > 64 || !/^\d{6}$/.test(token || '')) return null;
    const user = Object.hasOwn(this.users, username) ? this.users[username] : null;
    this.busy++;
    let supplied;
    try { supplied = await passwordHash(password, user?.salt || '00000000000000000000000000000000'); } finally { this.busy--; }
    if (!user || !timingSafeEqual(Buffer.from(supplied.hash, 'hex'), Buffer.from(user.hash, 'hex'))) return null;
    const now = this.now(), totp = new TOTP({ secret: user.totpSecret, digits: 6, period: 30, algorithm: 'SHA1' });
    const delta = totp.validate({ token, timestamp: now, window: 1 });
    if (delta === null || !this.store.useOTP(username, Math.floor(now / 30000) + delta)) return null;
    const session = randomBytes(32).toString('hex');
    this.sessions.set(this.digest(session), { username, role: user.role, expires: now + 1800000 }); return session;
  }
  digest(token) { return createHash('sha256').update(token).digest('hex'); }
  get(token) { if (!/^[a-f0-9]{64}$/.test(token || '')) return null; const s = this.sessions.get(this.digest(token)); return s && s.expires > this.now() ? s : null; }
  logout(token) { if (token) this.sessions.delete(this.digest(token)); }
  sweep() { for (const [k, v] of this.sessions) if (v.expires <= this.now()) this.sessions.delete(k); this.limiter.sweep(); }
}
