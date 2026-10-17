import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const derive = promisify(scrypt);
const digest = (value) => createHash('sha256').update(value).digest('hex');
export const COOKIE = 'table_session';
export const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;

export function sessionToken(cookie = '') {
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
}

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
  const publicUser = (row) => row && ({ id: row.id, username: row.username, displayName: row.display_name });
  return {
    async register(username, displayName, password) {
      const salt = randomBytes(16).toString('hex');
      const hash = (await derive(password, salt, 64)).toString('hex');
      const result = db.prepare('INSERT INTO users (username, display_name, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(username, displayName, salt, hash, Date.now());
      return { id: Number(result.lastInsertRowid), username, displayName };
    },
    async login(username, password) {
      const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      const actual = await derive(password, row?.salt || 'nonexistent-user-padding', 64);
      const expected = row ? Buffer.from(row.password_hash, 'hex') : Buffer.alloc(64);
      return timingSafeEqual(actual, expected) && row ? publicUser(row) : null;
    },
    issue(userId) {
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), userId, Date.now() + SESSION_AGE);
      return token;
    },
    authenticate(token) {
      if (!/^[a-f0-9]{64}$/.test(token)) return null;
      return publicUser(db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?').get(digest(token), Date.now()));
    },
    revoke(token) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token)); },
    prune() { db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()); },
    close() { db.close(); },
  };
}
