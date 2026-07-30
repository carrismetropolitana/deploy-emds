import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { AppConfig } from '../config/index.js';

export function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }

  return path;
}

export function buildSshTunnelArguments( config: AppConfig, verbose: boolean ): readonly string[] {
  //
  // Build the SSH tunnel arguments
  
  if (!config.databaseJumpServer) {
    throw new Error(
      'TUNNEL_JUMPSERVER is required to open the SSH tunnel',
    );
  }

  if (
    config.databaseUrl.startsWith('postgres://') ||
    config.databaseUrl.startsWith('postgresql://')
  ) {
    throw new Error(
      'DATABASE_URL must contain the remote database host when using the SSH tunnel',
    );
  }

  if (!config.databaseSshUser) {
    throw new Error('TUNNEL_USER is required to open the SSH tunnel');
  }

  const forward =
    `${config.databaseTunnelHost}:${config.databaseTunnelPort}:` +
    `${config.databaseUrl}:${config.databasePort}`;
  const destination =
    `${config.databaseSshUser}@${config.databaseJumpServer}`;

  return [
    ...(verbose ? ['-v'] : []),
    ...(config.databaseSshPrivateKey
      ? [
          '-i',
          expandHomePath(config.databaseSshPrivateKey),
          '-o',
          'IdentitiesOnly=yes',
        ]
      : []),
    '-N',
    '-L',
    forward,
    destination,
  ];
}
