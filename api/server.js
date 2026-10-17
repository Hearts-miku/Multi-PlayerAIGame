import { createRuntime } from '../server/runtime.js';

const runtime = createRuntime();
export default runtime.httpServer;
