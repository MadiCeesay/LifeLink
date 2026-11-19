import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { parseEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { initializeDatabase } from './config/initializeDatabase.js';
import { startEscalationLoop } from './services/escalationService.js';
export async function startServer(config) {
  await connectDatabase(config.MONGODB_URI);
  let server;
  try {
    await initializeDatabase();
    server = await new Promise((resolve, reject) => {
      const listener = createApp(config).listen(config.PORT, config.HOST ?? (config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'), () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) { await disconnectDatabase(); throw error; }
  const stopEscalation = config.NODE_ENV === 'test' ? () => {} : startEscalationLoop(config);
  let stopping;
  const stop = () => stopping ??= (async () => {
    stopEscalation();
    const deadline = setTimeout(() => { server.closeAllConnections(); }, 10000);
    deadline.unref();
    try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { clearTimeout(deadline); await disconnectDatabase(); }
  })();
  return { server, stop };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = parseEnv(process.env);
    const { stop } = await startServer(config);
    console.log(`LifeLink API listening on port ${config.PORT}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      stop().catch(() => { console.error('Shutdown failed'); process.exitCode = 1; });
    });
  } catch { console.error('Startup failed: check configuration and database availability'); process.exitCode = 1; }
}
