const SQL_IDENTIFIER_PATH_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/;
const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export interface AppConfig {
  readonly apiTable: string;
  readonly availableCacheSeconds: number;
  readonly databaseConnectionTimeoutMs: number;
  readonly databaseIdleTimeoutMs: number;
  readonly databaseJumpServer: string | undefined;
  readonly databaseName: string;
  readonly databasePassword: string | undefined;
  readonly databasePoolMax: number;
  readonly databasePort: number;
  readonly databaseSshPrivateKey: string | undefined;
  readonly databaseSshUser: string;
  readonly databaseSsl: boolean;
  readonly databaseSslRejectUnauthorized: boolean;
  readonly databaseTunnelHost: string;
  readonly databaseTunnelPort: number;
  readonly databaseUrl: string;
  readonly databaseUser: string;
  readonly downloadCacheSeconds: number;
  readonly downloadRateLimitMax: number;
  readonly host: string;
  readonly logLevel: string;
  readonly nodeEnv: string;
  readonly port: number;
  readonly referenceColumn: string;
  readonly trustProxy: boolean;
}

function getInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number, minimum: number): number {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
}

function getBoolean(environment: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false"`);
}

function getIdentifierPath(environment: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATH_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier path`);
  }

  return value;
}

function getIdentifier(environment: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier`);
  }

  return value;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    apiTable: getIdentifierPath(
      environment,
      'DB_API_TABLE',
      'mobilidade.api_general',
    ),
    availableCacheSeconds: getInteger(
      environment,
      'available_CACHE_SECONDS',
      300,
      0,
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
    databaseJumpServer:
      environment.TUNNEL_JUMPSERVER?.trim() ||
      environment.DATABASE_JUMPSERVER?.trim() ||
      undefined,
    databaseName: environment.DATABASE_NAME?.trim() || 'emds',
    databasePassword:
      environment.DATABASE_PASSWORD ?? environment.PGPASSWORD,
    databasePoolMax: getInteger(environment, 'DB_POOL_MAX', 4, 1),
    databasePort: getInteger(environment, 'DATABASE_PORT', 5_432, 1),
    databaseSshPrivateKey:
      environment.TUNNEL_PRIVATE_KEY?.trim() ||
      environment.DATABASE_SSH_PRIVATE_KEY?.trim() ||
      undefined,
    databaseSshUser:
      environment.TUNNEL_USER?.trim() ||
      environment.DATABASE_SSH_USER?.trim() ||
      environment.DATABASE_USER?.trim() ||
      '',
    databaseSsl: getBoolean(environment, 'DATABASE_SSL', false),
    databaseSslRejectUnauthorized: getBoolean(
      environment,
      'DATABASE_SSL_REJECT_UNAUTHORIZED',
      true,
    ),
    databaseTunnelHost:
      environment.TUNNEL_HOST?.trim() ||
      environment.DATABASE_TUNNEL_HOST?.trim() || '127.0.0.1',
    databaseTunnelPort:
      environment.TUNNEL_PORT === undefined ||
      environment.TUNNEL_PORT === ''
        ? getInteger(environment, 'DATABASE_TUNNEL_PORT', 6_092, 1)
        : getInteger(environment, 'TUNNEL_PORT', 6_092, 1),
    databaseUrl,
    databaseUser:
      environment.DATABASE_USER?.trim() ||
      environment.TUNNEL_USER?.trim() ||
      '',
    downloadCacheSeconds: getInteger(
      environment,
      'DOWNLOAD_CACHE_SECONDS',
      3_600,
      0,
    ),
    downloadRateLimitMax: getInteger(
      environment,
      'DOWNLOAD_RATE_LIMIT_MAX',
      6,
      1,
    ),
    host: environment.HOST?.trim() || '0.0.0.0',
    logLevel: environment.LOG_LEVEL?.trim() || 'info',
    nodeEnv:
      environment.NODE_ENV?.trim() ||
      environment.ENVIRONMENT?.trim() ||
      'development',
    port: getInteger(environment, 'PORT', 3_000, 1),
    referenceColumn: getIdentifier(
      environment,
      'DB_REFERENCE_COLUMN',
      'reference_type',
    ),
    trustProxy: getBoolean(environment, 'TRUST_PROXY', false),
  };
}
