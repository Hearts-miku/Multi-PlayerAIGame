import { existsSync } from 'node:fs';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3000);
const origins = (process.env.APP_ORIGIN || `http://localhost:${port},http://localhost:5173`).split(',').map((s) => s.trim()).filter(Boolean);
const secure = process.env.COOKIE_SECURE === 'true';
if (process.env.NODE_ENV === 'production' && (!secure || origins.some((o) => !o.startsWith('https://')))) throw new Error('Production requires COOKIE_SECURE=true and HTTPS APP_ORIGIN');
const runtime = createApp({ databasePath: process.env.DATABASE_PATH || './data/game.sqlite', origins, secure, trustProxy: Number(process.env.TRUST_PROXY || 0) });
runtime.httpServer.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`同桌已启动：http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(0); });
