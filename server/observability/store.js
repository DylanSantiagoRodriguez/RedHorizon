import { DatabaseSync } from 'node:sqlite';
import { validEvent, topicFor } from './kafka.js';
export class EventStore {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000; PRAGMA auto_vacuum=INCREMENTAL; CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, at INTEGER, source TEXT, topic TEXT, body TEXT); CREATE INDEX IF NOT EXISTS events_at ON events(at); CREATE TABLE IF NOT EXISTS otp(user TEXT PRIMARY KEY, step INTEGER);');
  }
  add(raw, expectedTopic) { const e = validEvent(raw), topic = topicFor(e); if (expectedTopic && expectedTopic !== topic) throw new Error('Wrong topic'); return this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)').run(e.eventId, e.timestamp, e.source, topic, JSON.stringify(e)).changes; }
  events(since, admin = false) { return this.db.prepare('SELECT body FROM events WHERE at>=? AND (? OR topic NOT LIKE ?) ORDER BY at DESC LIMIT 200').all(since, Number(admin), '%.security.v1').map(r => JSON.parse(r.body)); }
  version(source) { const row = this.db.prepare('SELECT body FROM events WHERE source=? AND topic LIKE ? ORDER BY at DESC LIMIT 1').get(source, '%.deployment.v1'); return row ? JSON.parse(row.body).data.revision : null; }
  useOTP(user, step) { return this.db.prepare('INSERT INTO otp VALUES(?,?) ON CONFLICT(user) DO UPDATE SET step=excluded.step WHERE otp.step<excluded.step').run(user, step).changes === 1; }
  prune(now = Date.now()) { this.db.prepare('DELETE FROM events WHERE at<?').run(now - 7 * 86400000); this.db.exec('DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY at DESC LIMIT -1 OFFSET 50000); PRAGMA wal_checkpoint(TRUNCATE); PRAGMA incremental_vacuum;'); }
  close() { this.db.close(); }
}
