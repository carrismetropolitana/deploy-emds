import { describe, expect, it } from 'vitest';

import {
  buildSshTunnelArguments,
  expandHomePath,
} from '../src/tunnel-manager.js';
import { testConfig } from './helpers.js';

describe('buildSshTunnelArguments', () => {
  it('builds the configured local forward without using a shell', () => {
    const arguments_ = buildSshTunnelArguments(
      {
        ...testConfig,
        databaseJumpServer: 'js.carrismetropolitana.pt',
        databasePort: 5_432,
        databaseSshPrivateKey: '/Users/test/.ssh/SSH Key',
        databaseSshUser: 'ubuntu',
        databaseTunnelHost: '127.0.0.1',
        databaseTunnelPort: 6_092,
        databaseUrl: '10.129.62.1',
      },
      true,
    );

    expect(arguments_).toEqual([
      '-v',
      '-i',
      '/Users/test/.ssh/SSH Key',
      '-o',
      'IdentitiesOnly=yes',
      '-N',
      '-L',
      '127.0.0.1:6092:10.129.62.1:5432',
      'ubuntu@js.carrismetropolitana.pt',
    ]);
  });

  it('expands a private key path relative to the home directory', () => {
    expect(expandHomePath('~/.ssh/SSH Key')).not.toContain('~');
    expect(expandHomePath('/tmp/test-key')).toBe('/tmp/test-key');
  });
});
