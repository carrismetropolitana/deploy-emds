import { loadConfig } from './config.js';
import { ensureSshTunnel, waitForProcess } from './tunnel-manager.js';

const config = loadConfig();
const tunnel = await ensureSshTunnel(config, true);
process.exitCode = tunnel ? await waitForProcess(tunnel) : 0;
