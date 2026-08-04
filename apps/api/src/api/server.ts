/**
 * Entrypoint script for starting the API server.
 *
 * - Loads server and database configuration.
 * - Initializes the PostgreSQL source repository and SQLite download cache.
 * - Builds and starts the Fastify application.
 * - Handles graceful shutdown on SIGINT/SIGTERM.
 * - On startup, performs a ping to the database to verify connectivity.
 *
 * Usage:
 *   node src/api/server.ts
 */

import { buildApp } from './app.js';
import { loadConfig } from '../config/index.js';
import { createPool } from '../database/pool.js';
import { SQLiteDownloadCache } from '../database/sqlite/download-cache.js';
import { PostgresPublicDataRepository } from '../database/repository/postgres.js';
import { SQLiteCachedPublicDataRepository } from '../database/repository/sqlite-cache.js';

// Load application configuration (API, DB, etc.)
const config = loadConfig();

// Create a PostgreSQL connection pool using configuration.
const pool = createPool(config);

// Initialize PostgreSQL as the source repository.
const postgresRepository = new PostgresPublicDataRepository(pool, {
  apiTable: config.apiTable,
  referenceColumn: config.referenceColumn,
});

// Persist generated download content locally so repeated requests can be
// served without querying PostgreSQL again.
const repository = new SQLiteCachedPublicDataRepository(
  postgresRepository,
  new SQLiteDownloadCache(),
);

// Build Fastify app with loaded config and repository.
const app = await buildApp({ config, repository });
repository.startQueue();

// Graceful shutdown flag.
let shuttingDown = false;

/**
 * Graceful shutdown logic for SIGINT/SIGTERM.
 * Attempts to close the Fastify app and sets appropriate process exit codes.
 *
 * @param signal - The signal which triggered shutdown.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    // Prevents duplicate shutdown attempts.
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

// Listen for termination signals to shutdown gracefully.
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  // Verify DB connection before starting the server.
  await repository.ping();
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, 'API startup failed');
  await app.close();
  process.exitCode = 1;
}
