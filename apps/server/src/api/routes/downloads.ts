import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import type { AppConfig } from '../../config/index.js';
import type {
  CsvDownloadStream,
  PublicDataRepository,
} from '../../database/repository/types.js';
import type { DownloadFilters } from '../../domain/consts.js';
import { ServiceUnavailableError } from '../errors.js';
import { errorSchema } from '../schemas/common.js';
import {
  downloadMetadataResponseSchema,
  downloadQuerySchema,
} from '../schemas/downloads.js';

interface DownloadRoutesOptions {
  readonly config: AppConfig;
  readonly repository: PublicDataRepository;
}

function downloadPeriod(filters: DownloadFilters): string {
  if (filters.yearmonth !== undefined) {
    return filters.yearmonth;
  }

  return `${filters.yearmonth_from}-${filters.yearmonth_to}`;
}

function downloadFilename(filters: DownloadFilters): string {
  const referenceSuffix =
    filters.reference === undefined ? '' : `_${filters.reference}`;
  const routeSuffix =
    filters.route_id === undefined
      ? ''
      : `_route-${filters.route_id}`;

  return `api_general_${downloadPeriod(filters)}_${filters.agency_id}${referenceSuffix}${routeSuffix}.csv`;
}

function hasInvalidRange(filters: DownloadFilters): boolean {
  return (
    filters.yearmonth === undefined &&
    filters.yearmonth_from > filters.yearmonth_to
  );
}

function sendInvalidRange(reply: FastifyReply): FastifyReply {
  return reply.code(400).send({
    error: {
      code: 'INVALID_QUERY',
      message: 'yearmonth_from must be before or equal to yearmonth_to',
    },
  });
}

async function getDownloadMetadata(
  request: FastifyRequest<{ Querystring: DownloadFilters }>,
  reply: FastifyReply,
  repository: PublicDataRepository,
): Promise<
  FastifyReply | {
    readonly filters: DownloadFilters;
    readonly rows: number;
  }
> {
  if (hasInvalidRange(request.query)) {
    return sendInvalidRange(reply);
  }

  try {
    const rows = await repository.countApiGeneralDownload(request.query);
    reply.header('Cache-Control', 'no-store');
    return { filters: request.query, rows };
  } catch (error) {
    throw new ServiceUnavailableError(
      'The database is temporarily unavailable',
      { cause: error },
    );
  }
}

async function streamDownload(
  request: FastifyRequest<{ Querystring: DownloadFilters }>,
  reply: FastifyReply,
  repository: PublicDataRepository,
  cacheSeconds: number,
): Promise<FastifyReply> {
  if (hasInvalidRange(request.query)) {
    return sendInvalidRange(reply);
  }

  let stream: CsvDownloadStream;
  try {
    stream = await repository.createApiGeneralDownload(request.query);
  } catch (error) {
    throw new ServiceUnavailableError(
      'The database is temporarily unavailable',
      { cause: error },
    );
  }

  stream.once('error', (error) => {
    request.log.error({ err: error }, 'CSV download stream failed');
  });
  stream.once('end', () => {
    request.log.info(
      { filters: request.query, rows: stream.rowCount },
      'CSV download completed',
    );
  });

  reply
    .code(200)
    .header('Cache-Control', `public, max-age=${cacheSeconds}`)
    .header(
      'Content-Disposition',
      `attachment; filename="${downloadFilename(request.query)}"`,
    )
    .header('X-Accel-Buffering', 'no')
    .header('X-Content-Type-Options', 'nosniff')
    .type('text/csv; charset=utf-8');

  return reply.send(stream);
}

export function registerDownloadRoutes(
  app: FastifyInstance,
  options: DownloadRoutesOptions,
): void {
  const { config, repository } = options;
  const routeConfig = {
    rateLimit: {
      max: config.downloadRateLimitMax,
      timeWindow: 60_000,
    },
  };

  app.get<{ Querystring: DownloadFilters }>(
    '/api',
    {
      config: routeConfig,
      schema: {
        tags: ['Downloads'],
        summary: 'Show filtered dataset metadata',
        description:
          'Returns the applied filters and number of matching rows.',
        querystring: downloadQuerySchema,
        produces: ['application/json'],
        response: {
          200: downloadMetadataResponseSchema,
          400: errorSchema,
          429: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) =>
      getDownloadMetadata(request, reply, repository),
  );

  app.get<{ Querystring: DownloadFilters }>(
    '/api/download',
    {
      config: routeConfig,
      schema: {
        tags: ['Downloads'],
        summary: 'Download filtered road-link data as CSV',
        description:
          'Streams matching mobilidade.api_general rows directly from PostgreSQL.',
        querystring: downloadQuerySchema,
        produces: ['text/csv'],
        response: {
          200: {
            type: 'string',
            contentMediaType: 'text/csv',
            description: 'CSV download stream.',
          },
          400: errorSchema,
          429: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) =>
      streamDownload(
        request,
        reply,
        repository,
        config.downloadCacheSeconds,
      ),
  );
}
