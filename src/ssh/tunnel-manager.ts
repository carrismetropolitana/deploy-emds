/**
 * SSH Tunnel Management utilities for database connectivity.
 *
 * Responsible for:
 *   - Constructing SSH tunnel command-line arguments.
 *   - Detecting the presence/availability of an SSH tunnel.
 *   - Ensuring an SSH tunnel is up, reliably waiting for readiness.
 *   - Waiting on child SSH processes.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { AppConfig } from '../config.js';

/**
 * Expand ~ and ~/ in file system paths to absolute paths using the user's home directory.
 * If the input path is just '~', returns the home directory path.
 * If the input path starts with '~/', expands to an absolute path under the home directory.
 * Otherwise, returns the original path unchanged.
 */
export function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }

  return path;
}

/**
 * Build the argv for an SSH client to open a local tunnel to a remote database,
 * using configuration from AppConfig.
 *
 * @param config - Application configuration, including jump server and DB details.
 * @param verbose - If true, include verbose SSH output.
 * @returns Readonly array of SSH client arguments for spawning a tunnel.
 * @throws If required config parameters are missing or invalid.
 */
export function buildSshTunnelArguments(config: AppConfig, verbose: boolean): readonly string[] {
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

  // Format: local_host:local_port:remote_host:remote_port
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

/**
 * Checks if a local TCP port is listening, used to detect tunnel readiness.
 *
 * @param host - Host to connect to (usually 127.0.0.1).
 * @param port - Port to check.
 * @returns Promise resolved to true if there is a listener, false otherwise.
 */
export async function isTunnelListening(host: string, port: number): Promise<boolean> {
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

/**
 * Ensures the SSH tunnel for the database is active, launching ssh if necessary.
 *
 * - Noop if no jump server is configured.
 * - If a tunnel is already listening, prints a message and returns undefined.
 * - If not, spawns an ssh tunnel and waits until it is listening or times out.
 *
 * @param config - Application config with SSH and DB settings.
 * @param verbose - If true, pass -v to ssh for verbose output.
 * @returns ChildProcess for the ssh tunnel, or undefined if already up/no tunnel needed.
 * @throws If preconditions fail or tunnel fails to come up.
 */
export async function ensureSshTunnel(
  config: AppConfig,
  verbose = false,
): Promise<ChildProcess | undefined> {
  if (!config.databaseJumpServer) {
    return undefined;
  }

  if (
    await isTunnelListening(config.databaseTunnelHost, config.databaseTunnelPort)
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

  // Wait until tunnel is ready, the child errors, or timeout
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

/**
 * Waits for a spawned process to exit, returning its status code.
 *
 * - If exited due to SIGINT or SIGTERM, returns 0.
 * - If exited with other code, returns the code or 1 if unknown.
 * - If failed to start, prints a message and returns 1.
 *
 * @param child - ChildProcess to wait on.
 * @returns Promise with exit code (0 = normal stop, 1 = error).
 */
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
