import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { AppConfig } from './config.js';

export function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }

  return path;
}

export function buildSshTunnelArguments(
  config: AppConfig,
  verbose: boolean,
): readonly string[] {
  if (!config.databaseJumpServer) {
    throw new Error('TUNNEL_JUMPSERVER is required to open the SSH tunnel');
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

  const forward = `${config.databaseTunnelHost}:${config.databaseTunnelPort}:${config.databaseUrl}:${config.databasePort}`;
  const destination = `${config.databaseSshUser}@${config.databaseJumpServer}`;

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

export async function isTunnelListening(
  host: string,
  port: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (listening: boolean): void => {
      socket.destroy();
      resolve(listening);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

export async function ensureSshTunnel(
  config: AppConfig,
  verbose = false,
): Promise<ChildProcess | undefined> {
  if (!config.databaseJumpServer) {
    return undefined;
  }

  if (
    await isTunnelListening(
      config.databaseTunnelHost,
      config.databaseTunnelPort,
    )
  ) {
    console.info(
      `Using existing PostgreSQL tunnel at ${config.databaseTunnelHost}:${config.databaseTunnelPort}`,
    );
    return undefined;
  }

  if (config.databaseSshPrivateKey) {
    const privateKey = expandHomePath(config.databaseSshPrivateKey);
    try {
      await access(privateKey);
    } catch {
      throw new Error(`SSH private key not found or unreadable: ${privateKey}`);
    }
  }

  const sshArguments = buildSshTunnelArguments(config, verbose);
  const ssh = spawn('ssh', sshArguments, { stdio: 'inherit' });
  const deadline = Date.now() + config.databaseConnectionTimeoutMs;
  let spawnError: Error | undefined;

  ssh.once('error', (error) => {
    spawnError = error;
  });

  while (Date.now() < deadline) {
    if (spawnError) {
      throw spawnError;
    }

    if (ssh.exitCode !== null) {
      throw new Error(`ssh exited before the tunnel was ready (${ssh.exitCode})`);
    }

    if (
      await isTunnelListening(
        config.databaseTunnelHost,
        config.databaseTunnelPort,
      )
    ) {
      return ssh;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  ssh.kill('SIGTERM');
  throw new Error(
    `SSH tunnel did not become ready at ${config.databaseTunnelHost}:${config.databaseTunnelPort}`,
  );
}

export async function waitForProcess(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.once('error', (error) => {
      console.error(`Could not start ${child.spawnfile}:`, error.message);
      resolve(1);
    });
    child.once('exit', (code, signal) => {
      if (signal) {
        resolve(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}
