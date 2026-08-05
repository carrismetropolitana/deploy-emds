import type { FastifyRequest } from 'fastify';

import { DOWNLOAD_SUFFIX } from '../../types/consts.js';

/* * */

export function isDownloadRequest(request: FastifyRequest): boolean {
  return request.raw.url?.includes(DOWNLOAD_SUFFIX) ?? false;
}
