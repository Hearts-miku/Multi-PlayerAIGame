import { createApp } from './app.js';
import { redisBackend } from './redis-backend.js';

export function createRuntime() {
  const port = Number(process.env.PORT || 3000), deployed = process.env.VERCEL === '1';
  const secure = deployed || process.env.COOKIE_SECURE === 'true';
  const origins = (process.env.APP_ORIGIN || `http://localhost:${port},http://localhost:5173`).split(',').map((s) => s.trim()).filter(Boolean);
  if (deployed) for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) if (host) origins.push(`https://${host}`);
  if (process.env.NODE_ENV === 'production' && (!secure || origins.some((o) => !o.startsWith('https://')))) throw new Error('Production requires HTTPS APP_ORIGIN and Secure cookies');
  if (deployed && !process.env.REDIS_URL) throw new Error('Vercel requires a provisioned REDIS_URL');
  return createApp({
    databasePath: process.env.DATABASE_PATH || './data/game.sqlite', origins: [...new Set(origins)], secure,
    trustProxy: deployed ? 1 : Number(process.env.TRUST_PROXY || 0),
    ...(process.env.REDIS_URL ? { backend: redisBackend(process.env.REDIS_URL, process.env.REDIS_PREFIX || (deployed && process.env.VERCEL_ENV !== 'production' ? 'tongzhuo:preview:v1:' : 'tongzhuo:v1:')) } : {}),
  });
}
