/**
 * Creates a PostgreSQL connection pool with configuration adapted for direct or SSH tunnel connections.
 *
 * This utility inspects the provided AppConfig to determine whether to connect via a full URL or to
 * construct the connection parameters manually. If an SSH tunnel is configured, it sets the host and port
 * to the tunnel's values. SSL is used if requested in the config.
 *
 * @param config Application configuration containing database connection settings.
 * @returns Configured pg.Pool instance.
 *
 * Logic:
 * - If `databaseUrl` is a connection string (starts with 'postgres://' or 'postgresql://'), use it directly.
 * - If not, build the connection parameters from explicit fields.
 *   - If SSH tunneling is in use, use tunnel host and port.
 *   - Otherwise use the plain databaseUrl as host and databasePort as port.
 * - Pass global pool options (timeouts, SSL, max connections, etc.).
 */
import { Pool } from 'pg';

import type { AppConfig } from '../config.js';

/**
 * Create and configure a PostgreSQL connection pool for the app.
 */
export function createPool(config: AppConfig): Pool {
  // Detect connection string usage based on URL prefix
  const isConnectionString =
    config.databaseUrl.startsWith('postgres://') ||
    config.databaseUrl.startsWith('postgresql://');
  // Determine if an SSH tunnel should be used
  const usesSshTunnel =
    !isConnectionString && config.databaseJumpServer !== undefined;
  // Configure the connection based on mode
  const connection = isConnectionString
    ? { connectionString: config.databaseUrl }
    : {
        database: config.databaseName,
        host: usesSshTunnel ? config.databaseTunnelHost : config.databaseUrl,
        password: config.databasePassword,
        port: usesSshTunnel ? config.databaseTunnelPort : config.databasePort,
        user: config.databaseUser,
      };

  return new Pool({
    application_name: 'deploy-emds-public-api',
    ...connection,
    // How long to wait for a new connection (ms)
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    // How long connections may remain idle before being closed (ms)
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    // Keep TCP connections alive
    keepAlive: true,
    // Max pool size
    max: config.databasePoolMax,
    // SSL options if enabled
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
  });
}
