import type { ZipArchive } from 'archiver';
import type { FastifyRequest } from 'fastify';

/* * */

export function finalizeZipStream(
  request: FastifyRequest,
  archive: ZipArchive,
): void {
  void archive.finalize().catch((error: unknown) => {
    request.log.error({ err: error }, 'CSV ZIP archive finalization failed');
  });
}
