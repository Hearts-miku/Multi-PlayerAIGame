import { createStore } from './store.js';
import { Games } from './game.js';

export function localBackend(databasePath) {
  const store = createStore(databasePath), games = new Games();
  const connections = new Map(), limits = new Map(), listeners = new Set();
  return {
    kind: 'sqlite', store, games, ready: Promise.resolve(),
    async presence(touch = [], remove = []) {
      for (const [connection, user] of touch) connections.set(connection, { user, expires: Date.now() + 120_000 });
      for (const connection of remove) connections.delete(connection);
      for (const [key, entry] of connections) if (entry.expires < Date.now()) connections.delete(key);
      return [...new Set([...connections.values()].map((entry) => entry.user))];
    },
    async limit(key, maximum, duration) {
      const now = Date.now();
      for (const [name, entry] of limits) if (entry.until < now) limits.delete(name);
      const entry = limits.get(key) || { count: 0, until: now + duration };
      limits.set(key, entry); return ++entry.count <= maximum;
    },
    listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async publish(event) { await Promise.all([...listeners].map((fn) => fn(event))); },
    async close() { listeners.clear(); store.close(); },
  };
}
