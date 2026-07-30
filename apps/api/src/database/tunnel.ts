import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { SshTunnel } from '@tmlmobilidade/ssh';

import type { AppConfig } from '../config/index.js';

function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir();
  }

  return path.startsWith('~/')
    ? resolve(homedir(), path.slice(2))
    : path;
}

export async function createDatabaseTunnel(
  config: AppConfig,
): Promise<SshTunnel | undefined> {
  if (
    config.nodeEnv !== 'development' ||
    config.databaseJumpServer === undefined
  ) {
    return undefined;
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

  const privateKey = config.databaseSshPrivateKey
    ? await readFile(expandHomePath(config.databaseSshPrivateKey))
    : undefined;
  const agent = process.env.SSH_AUTH_SOCK?.trim();

  if (privateKey === undefined && !agent) {
    throw new Error(
      'TUNNEL_PRIVATE_KEY_PATH or SSH_AUTH_SOCK is required to open the SSH tunnel',
    );
  }

  return new SshTunnel(
    {
      forwardOptions: {
        dstAddr: config.databaseUrl,
        dstPort: config.databasePort,
        srcAddr: config.databaseTunnelHost,
        srcPort: config.databaseTunnelPort,
      },
      serverOptions: {
        host: config.databaseTunnelHost,
        port: config.databaseTunnelPort,
      },
      sshOptions: {
        ...(agent ? { agent } : {}),
        host: config.databaseJumpServer,
        keepaliveCountMax: 3,
        keepaliveInterval: 10_000,
        ...(privateKey ? { privateKey } : {}),
        username: config.databaseSshUser,
      },
      tunnelOptions: {
        autoClose: false,
        reconnectOnError: true,
      },
    },
    {
      maxRetries: 3,
    },
  );
}
