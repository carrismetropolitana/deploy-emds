/**
 * Launcher script for starting the API server with optional SSH tunneling.
 *
 * - Sets up an SSH tunnel as required by the current configuration.
 * - Starts the API server, either in watch mode (for development) or production mode.
 * - Handles clean shutdown on SIGINT/SIGTERM, ensuring both subprocesses exit gracefully.
 */

import { spawn } from 'node:child_process';

import { loadConfig } from './config/index.js';
import { waitForProcess } from './ssh/process.js';
import { ensureSshTunnel } from './ssh/tunnel-manager.js';

// Load application configuration from environment
const config = loadConfig();

// Determine if "watch" mode (for development) is enabled via the command line
const watch = process.argv.includes('--watch');
 
// Ensure SSH tunnel is established (as required by config).
// The function returns a ChildProcess if tunneling is needed, or undefined.
const tunnel = await ensureSshTunnel(config, true);

// Compose the arguments for starting the API server.
// - In watch mode, use tsx loader and watch for changes in source files.
// - In production mode, run built JS (with source maps enabled).
const serverArguments = watch
  ? ['--import', 'tsx', '--watch', 'src/api/server.ts']
  : ['--enable-source-maps', 'dist/api/server.js'];

// Spawn the API server as a child process, inheriting stdio for seamless console logging.
const server = spawn(process.execPath, serverArguments, {
  env: process.env,
  stdio: 'inherit',
});

// Used to prevent double shutdown logic on repeated signals
let stopping = false;

/**
 * Graceful shutdown handler, kills both server and tunnel subprocesses.
 * @param signal The signal causing the shutdown (e.g., 'SIGINT', 'SIGTERM')
 */
function stop(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }
  stopping = true;
  server.kill(signal);
  tunnel?.kill(signal);
}

// Listen for SIGINT and SIGTERM to trigger orderly shutdown
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

// Wait for the API server process to exit, capturing its exit code
const exitCode = await waitForProcess(server);

// If an SSH tunnel was started and is still running, ensure it is killed
if (tunnel && tunnel.exitCode === null) {
  tunnel.kill('SIGTERM');
}

// Set process exit code to match that of the API server
process.exitCode = exitCode;
