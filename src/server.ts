import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { PostgresPublicDataRepository } from './repository.js';

const config = loadConfig();
const pool = createPool(config);
const repository = new PostgresPublicDataRepository(pool, {
  apiTable: config.apiTable,
  referenceColumn: config.referenceColumn,
});
const app = await buildApp({ config, repository });

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down');

  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error }, 'Graceful shutdown failed');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await repository.ping();
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, 'API startup failed');
  await app.close();
  process.exitCode = 1;
}
