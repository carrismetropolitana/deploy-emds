import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';

import type { AppConfig } from '../config/index.js';
import { buildSshTunnelArguments, expandHomePath } from './arguments.js';
import { isTunnelListening } from './process.js';

export async function ensureSshTunnel( config: AppConfig, verbose = false ): Promise<ChildProcess | undefined> {
  //
  // Ensure the SSH tunnel is running
  
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
      throw new Error(
        `SSH private key not found or unreadable: ${privateKey}`,
      );
    }
  }

  const ssh = spawn(
    'ssh',
    buildSshTunnelArguments(config, verbose),
    { stdio: 'inherit' },
  );
  const deadline =
    Date.now() + config.databaseConnectionTimeoutMs;
  let spawnError: Error | undefined;

  ssh.once('error', (error) => {
    spawnError = error;
  });

  while (Date.now() < deadline) {
    if (spawnError) {
      throw spawnError;
    }

    if (ssh.exitCode !== null) {
      throw new Error(
        `ssh exited before the tunnel was ready (${ssh.exitCode})`,
      );
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
