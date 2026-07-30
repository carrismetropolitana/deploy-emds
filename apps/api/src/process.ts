import type { ChildProcess } from 'node:child_process';

export async function waitForProcess(child: ChildProcess): Promise<number> {
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
