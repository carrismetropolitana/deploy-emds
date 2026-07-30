/**
 * Entrypoint script to establish and monitor an SSH tunnel for database access.
 *
 * - Loads application configuration (including SSH and database settings).
 * - Ensures the SSH tunnel is up (spawning ssh if necessary, using verbose mode).
 * - If a tunnel was spawned, waits for its exit and sets process exit code accordingly.
 * - If tunnel already exists or is not needed, exits with code 0.
 *
 * Usage:
 *   node src/ssh/tunnel.ts
 */
import { loadConfig } from '../config/index.js';
import { waitForProcess } from './process.js';
import { ensureSshTunnel } from './tunnel-manager.js';

const config = loadConfig();

// Attempt to ensure the SSH tunnel is running (in verbose mode)
// If the tunnel is already up or not required, tunnel will be undefined
const tunnel = await ensureSshTunnel(config, true);

// If a tunnel process was spawned, wait for it to exit and set exit code accordingly
// Otherwise, set exit code to 0
process.exitCode = tunnel ? await waitForProcess(tunnel) : 0;
