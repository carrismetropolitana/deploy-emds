import { spawn } from 'node:child_process';

import { loadConfig } from './config.js';
import { ensureSshTunnel, waitForProcess } from './tunnel-manager.js';

const config = loadConfig();
const watch = process.argv.includes('--watch');
const tunnel = await ensureSshTunnel(config, true);
const serverArguments = watch
  ? ['--env-file=.env', '--import', 'tsx', '--watch', 'src/server.ts']
  : ['--env-file=.env', '--enable-source-maps', 'dist/server.js'];
const server = spawn(process.execPath, serverArguments, {
  env: process.env,
  stdio: 'inherit',
});

let stopping = false;

function stop(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;
  server.kill(signal);
  tunnel?.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

const exitCode = await waitForProcess(server);

if (tunnel && tunnel.exitCode === null) {
  tunnel.kill('SIGTERM');
}

process.exitCode = exitCode;
