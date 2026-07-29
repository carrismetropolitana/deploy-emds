import type { ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';

export async function isTunnelListening( host: string, port: number ): Promise<boolean> {
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

export async function waitForProcess( child: ChildProcess ): Promise<number> {
  return new Promise((resolve) => {
    child.once('error', (error) => {
      console.error(
        `Could not start ${child.spawnfile}:`,
        error.message,
      );
      resolve(1);
    });
    child.once('exit', (code, signal) => {
      if (signal) {
        resolve(
          signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1,
        );
        return;
      }

      resolve(code ?? 1);
    });
  });
}
