import { ZipArchive } from 'archiver';
import type { FastifyRequest } from 'fastify';

import type { CsvDownloadStream } from '../../types/interfaces/download.js';

/* * */

export function createZipStream(
  request: FastifyRequest,
  csvStream: CsvDownloadStream,
  csvFilename: string,
): ZipArchive {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('warning', (error) => {
    request.log.warn({ err: error }, 'CSV ZIP archive warning');
  });
  archive.on('error', (error) => {
    request.log.error({ err: error }, 'CSV ZIP archive failed');
  });
  archive.append(csvStream, { name: csvFilename });
  return archive;
}
