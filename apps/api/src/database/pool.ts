import { Pool } from 'pg';

import type { AppConfig } from '../config/types.js';

export function createPool(config: AppConfig): Pool {
  const isConnectionString =
    config.databaseUrl.startsWith('postgres://') ||
    config.databaseUrl.startsWith('postgresql://');
  const usesSshTunnel =
    config.nodeEnv === 'development' &&
    !isConnectionString &&
    config.databaseJumpServer !== undefined;
  const connection = isConnectionString
    ? { connectionString: config.databaseUrl }
    : {
        database: config.databaseName,
        host: usesSshTunnel
          ? config.databaseTunnelHost
          : config.databaseUrl,
        password: config.databasePassword,
        port: usesSshTunnel
          ? config.databaseTunnelPort
          : config.databasePort,
        user: config.databaseUser,
      };

  return new Pool({
    application_name: 'deploy-emds-public-api',
    ...connection,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    keepAlive: true,
    max: config.databasePoolMax,
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
  });
}
