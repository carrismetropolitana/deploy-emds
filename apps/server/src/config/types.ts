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
