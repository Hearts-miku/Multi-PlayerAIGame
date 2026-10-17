import { existsSync } from 'node:fs';
import { createRuntime } from './runtime.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3000);
const runtime = createRuntime();
runtime.httpServer.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`同桌已启动：http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(0); });
