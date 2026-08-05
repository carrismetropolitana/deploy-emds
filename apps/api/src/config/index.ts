import { getBoolean, getIdentifier, getIdentifierPath, getInteger } from './env.js';
import type { AppConfig } from './types.js';

/* * */

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  //

  //
  // Validate the database URL
  
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const environmentName =
    environment.NODE_ENV?.trim() ||
    environment.ENVIRONMENT?.trim() ||
    'development';
  const nodeEnv =
    environmentName === 'dev' ? 'development' : environmentName;
  const isDevelopment = nodeEnv === 'development';

  return {
    apiTable: getIdentifierPath(
      environment,
      'DB_API_TABLE',
      'mobilidade.api_general',
    ),
    databaseConnectionTimeoutMs: getInteger(
      environment,
      'DB_CONNECTION_TIMEOUT_MS',
      10_000,
      1,
    ),
    databaseIdleTimeoutMs: getInteger(
      environment,
      'DB_IDLE_TIMEOUT_MS',
      30_000,
      1,
    ),
    databaseJumpServer: isDevelopment
      ? environment.TUNNEL_JUMPSERVER?.trim() ||
        environment.DATABASE_JUMPSERVER?.trim() ||
        undefined
      : undefined,
    databaseName: environment.DATABASE_NAME?.trim() || 'emds',
    databasePassword:
      environment.DATABASE_PASSWORD ?? environment.PGPASSWORD,
    databasePoolMax: getInteger(environment, 'DB_POOL_MAX', 4, 1),
    databasePort: getInteger(environment, 'DATABASE_PORT', 5_432, 1),
    databaseSshPrivateKey: isDevelopment
      ? environment.TUNNEL_PRIVATE_KEY_PATH?.trim() ||
        environment.DATABASE_SSH_PRIVATE_KEY?.trim() ||
        undefined
      : undefined,
    databaseSshUser: isDevelopment
      ? environment.TUNNEL_USER?.trim() ||
        environment.DATABASE_SSH_USER?.trim() ||
        environment.DATABASE_USER?.trim() ||
        ''
      : '',
    databaseSsl: getBoolean(environment, 'DATABASE_SSL', false),
    databaseSslRejectUnauthorized: getBoolean(
      environment,
      'DATABASE_SSL_REJECT_UNAUTHORIZED',
      true,
    ),
    databaseTunnelHost:
      environment.TUNNEL_HOST?.trim() ||
      environment.DATABASE_TUNNEL_HOST?.trim() ||
      '127.0.0.1',
    databaseTunnelPort:
      environment.TUNNEL_PORT === undefined ||
      environment.TUNNEL_PORT === ''
        ? getInteger(environment, 'DATABASE_TUNNEL_PORT', 6_092, 1)
        : getInteger(environment, 'TUNNEL_PORT', 6_092, 1),
    databaseUrl,
    databaseUser:
      environment.DATABASE_USER?.trim() ||
      (isDevelopment ? environment.TUNNEL_USER?.trim() : undefined) ||
      '',
    host: environment.HOST?.trim() || '0.0.0.0',
    logLevel: environment.LOG_LEVEL?.trim() || 'info',
    nodeEnv,
    port: getInteger(environment, 'PORT', 3_000, 1),
    referenceColumn: getIdentifier(
      environment,
      'DB_REFERENCE_COLUMN',
      'reference_type',
    ),
    trustProxy: getBoolean(environment, 'TRUST_PROXY', false),
  };
}
