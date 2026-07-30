import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { CsvDownloadStream, PublicDataRepository } from '../../database/repository/types.js';
import type { DownloadFilters } from '../../domain/consts.js';
import { ServiceUnavailableError } from '../errors.js';
import { errorSchema } from '../schemas/common.js';
import { downloadMetadataResponseSchema, downloadQuerySchema } from '../schemas/downloads.js';

interface DownloadRoutesOptions {
  readonly repository: PublicDataRepository;
}

const DOWNLOAD_SUFFIX = '/download';
const downloadRequests = new WeakSet<FastifyRequest>();

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

async function getDownloadMetadata( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<
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

async function streamDownload( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<FastifyReply> {
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
    .header('Cache-Control', 'public, max-age=3600')
    .header(
      'Content-Disposition',
      `attachment; filename="${downloadFilename(request.query)}"`,
    )
    .header('X-Accel-Buffering', 'no')
    .header('X-Content-Type-Options', 'nosniff')
    .type('text/csv; charset=utf-8');

  return reply.send(stream);
}

export function registerDownloadRoutes( app: FastifyInstance, options: DownloadRoutesOptions ): void {
  const { repository } = options;
  const routeConfig = {
    rateLimit: {
      max: 6,
      timeWindow: 60_000,
    },
  };

  app.get<{ Querystring: DownloadFilters }>(
    '/api',
    {
      config: routeConfig,
      preValidation: async (request) => {
        if (!request.raw.url?.endsWith(DOWNLOAD_SUFFIX)) {
          return;
        }

        const mutableQuery = request.query as unknown as Record<
          string,
          string
        >;

        for (const [key, value] of Object.entries(mutableQuery)) {
          if (
            typeof value === 'string' &&
            value.endsWith(DOWNLOAD_SUFFIX)
          ) {
            mutableQuery[key] = value.slice(
              0,
              -DOWNLOAD_SUFFIX.length,
            );
            downloadRequests.add(request);
            return;
          }
        }
      },
      schema: {
        tags: ['Downloads'],
        summary: 'Show metadata or download the filtered CSV',
        description:
          'Returns JSON metadata normally. Append /download after the query to download the CSV.',
        querystring: downloadQuerySchema,
        produces: ['application/json', 'text/csv'],
        response: {
          200: {
            oneOf: [
              downloadMetadataResponseSchema,
              {
                type: 'string',
                contentMediaType: 'text/csv',
                description: 'CSV download stream.',
              },
            ],
          },
          400: errorSchema,
          429: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      if (downloadRequests.has(request)) {
        return streamDownload(request, reply, repository);
      }

      return getDownloadMetadata(request, reply, repository);
    },
  );

}