/**
 * Regular expression for validating a PostgreSQL identifier path (e.g., "schema.table").
 * - Segments must start with a letter or underscore, followed by letters, numbers, underscores, or dollar signs.
 * - Segments are separated by a period ('.').
 */
const SQL_IDENTIFIER_PATH_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/;

/**
 * Regular expression for validating a single PostgreSQL identifier (e.g., "table").
 * - Must start with a letter or underscore, followed by letters, numbers, underscores, or dollar signs.
 */
const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/**
 * Main configuration object describing application settings loaded from environment.
 */
export interface AppConfig {
  /** Full path to the main API metadata table (e.g., "mobilidade.api_general"). */
  readonly apiTable: string;
  /** Number of seconds to cache the /available endpoint data. */
  readonly availableCacheSeconds: number;
  /** PostgreSQL connection timeout in milliseconds. */
  readonly databaseConnectionTimeoutMs: number;
  /** PostgreSQL idle timeout in milliseconds. */
  readonly databaseIdleTimeoutMs: number;
  /** Optional jump server (bastion) for database SSH tunneling. */
  readonly databaseJumpServer: string | undefined;
  /** PostgreSQL database name. */
  readonly databaseName: string;
  /** PostgreSQL database password (may be undefined if not required). */
  readonly databasePassword: string | undefined;
  /** Maximum pool size for database connections. */
  readonly databasePoolMax: number;
  /** PostgreSQL database port number. */
  readonly databasePort: number;
  /** Private key string for SSH tunneling (if required). */
  readonly databaseSshPrivateKey: string | undefined;
  /** SSH user for database tunneling (if required). */
  readonly databaseSshUser: string;
  /** Whether to use SSL for the PostgreSQL connection. */
  readonly databaseSsl: boolean;
  /** Whether to reject unauthorized database SSL certificates. */
  readonly databaseSslRejectUnauthorized: boolean;
  /** Local tunnel host for SSH connections (defaults to "127.0.0.1"). */
  readonly databaseTunnelHost: string;
  /** Local tunnel port for forwarding database connections. */
  readonly databaseTunnelPort: number;
  /** The connection string (URL) for the database. */
  readonly databaseUrl: string;
  /** Database user name for authentication. */
  readonly databaseUser: string;
  /** Number of seconds to cache downloadable data (API /download responses). */
  readonly downloadCacheSeconds: number;
  /** Maximum allowed API /download requests per IP per hour. */
  readonly downloadRateLimitMax: number;
  /** Bind address for the HTTP server. */
  readonly host: string;
  /** Logging level (e.g., "info", "debug", "warn"). */
  readonly logLevel: string;
  /** Node.js environment (e.g., "development", "production"). */
  readonly nodeEnv: string;
  /** HTTP server listen port number. */
  readonly port: number;
  /** Column name for the reference type in data queries. */
  readonly referenceColumn: string;
  /** Whether to trust a reverse proxy for "X-Forwarded-*" headers. */
  readonly trustProxy: boolean;
}

/**
 * Reads an integer value from the environment, with fallback and minimum.
 * @param environment The environment variables object.
 * @param name Name of the variable.
 * @param fallback Default value if variable is unset or empty.
 * @param minimum Minimum allowed value (inclusive).
 */
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

/**
 * Reads a boolean value from the environment, with fallback.
 * Accepts only "true" or "false" (case-sensitive).
 * @param environment The environment variables object.
 * @param name Name of the variable.
 * @param fallback Default value if variable is unset or empty.
 */
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

/**
 * Reads a dot-separated PostgreSQL identifier path from the environment,
 * falling back if missing or empty, and validates it.
 * @param environment The environment variables object.
 * @param name Name of the variable.
 * @param fallback Default value if variable is unset or empty.
 */
function getIdentifierPath(environment: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATH_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier path`);
  }

  return value;
}

/**
 * Reads a single PostgreSQL identifier from the environment, falling back if missing or empty, and validates it.
 * @param environment The environment variables object.
 * @param name Name of the variable.
 * @param fallback Default value if variable is unset or empty.
 */
function getIdentifier(environment: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier`);
  }

  return value;
}

/**
 * Loads the application configuration from the current process environment (or a supplied `environment` object).
 * Throws errors for missing required values or validation failures.
 * @param environment The environment variables object (defaults to `process.env`).
 * @returns Resolved application configuration.
 */
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
