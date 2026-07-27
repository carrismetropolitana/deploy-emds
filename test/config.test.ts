import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('loads defaults and the database URL', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://localhost/emds',
    });

    expect(config.databasePoolMax).toBe(4);
    expect(config.apiTable).toBe('mobilidade.api_general');
    expect(config.referenceColumn).toBe('reference_type');
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL is required');
  });

  it('rejects unsafe configurable SQL identifiers', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/emds',
        DB_API_TABLE: 'api_general; DROP TABLE users',
      }),
    ).toThrow('DB_API_TABLE must be a valid PostgreSQL identifier path');
  });

  it('supports the tunnel variables used by the local environment', () => {
    const config = loadConfig({
      DATABASE_URL: '10.129.62.1',
      DATABASE_NAME: 'emds',
      DATABASE_PORT: '5432',
      ENVIRONMENT: 'production',
      TUNNEL_JUMPSERVER: 'js.carrismetropolitana.pt',
      TUNNEL_PRIVATE_KEY: '~/.ssh/SSH Key',
      TUNNEL_USER: 'ubuntu',
    });

    expect(config.databaseUrl).toBe('10.129.62.1');
    expect(config.databaseJumpServer).toBe('js.carrismetropolitana.pt');
    expect(config.databaseName).toBe('emds');
    expect(config.databasePort).toBe(5_432);
    expect(config.databaseSshPrivateKey).toBe('~/.ssh/SSH Key');
    expect(config.databaseSshUser).toBe('ubuntu');
    expect(config.databaseTunnelHost).toBe('127.0.0.1');
    expect(config.databaseTunnelPort).toBe(6_092);
    expect(config.databaseUser).toBe('ubuntu');
    expect(config.nodeEnv).toBe('production');
  });

  it('accepts the standard PostgreSQL password variable as a fallback', () => {
    const config = loadConfig({
      DATABASE_URL: 'database.internal',
      PGPASSWORD: 'secret',
    });

    expect(config.databasePassword).toBe('secret');
  });

  it('rejects invalid booleans and integers', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/emds',
        DATABASE_SSL: 'yes',
      }),
    ).toThrow('DATABASE_SSL must be either "true" or "false"');

    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/emds',
        DB_POOL_MAX: '0',
      }),
    ).toThrow('DB_POOL_MAX must be an integer greater than or equal to 1');
  });
});
