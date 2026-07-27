import { describe, expect, it } from 'vitest';

import { createPool } from '../src/db.js';
import { testConfig } from './helpers.js';

describe('createPool', () => {
  it('connects through the local SSH forward when a jump server is configured', async () => {
    const pool = createPool({
      ...testConfig,
      databaseJumpServer: 'js.carrismetropolitana.pt',
      databasePort: 5_432,
      databaseTunnelHost: '127.0.0.1',
      databaseTunnelPort: 6_092,
      databaseUrl: '10.129.62.1',
      databaseUser: 'ubuntu',
    });

    expect(pool.options.host).toBe('127.0.0.1');
    expect(pool.options.port).toBe(6_092);
    expect(pool.options.database).toBe('emds');
    expect(pool.options.user).toBe('ubuntu');

    await pool.end();
  });

  it('connects directly when no jump server is configured', async () => {
    const pool = createPool({
      ...testConfig,
      databaseJumpServer: undefined,
      databasePort: 5_432,
      databaseUrl: 'database.internal',
    });

    expect(pool.options.host).toBe('database.internal');
    expect(pool.options.port).toBe(5_432);

    await pool.end();
  });
});
