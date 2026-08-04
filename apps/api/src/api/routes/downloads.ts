import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { CsvDownloadStream, PublicDataRepository } from '../../database/repository/types.js';
import type { DownloadFilters } from '../../domain/consts.js';
import { ServiceUnavailableError } from '../errors.js';
import { errorSchema } from '../schemas/common.js';
import { downloadFilterHelpResponseSchema, downloadMetadataResponseSchema, downloadQuerySchema } from '../schemas/downloads.js';
import { sendFilterHelp } from '../welcome.js';

interface DownloadRoutesOptions {
  readonly repository: PublicDataRepository;
}

const DOWNLOAD_SUFFIX = '/download';

function isDownloadRequest(request: FastifyRequest): boolean {
  return request.raw.url?.includes(DOWNLOAD_SUFFIX) ?? false;
}

function downloadPeriod(filters: DownloadFilters): string {
  return filters.yearmonth;
}

function downloadFilename(filters: DownloadFilters): string {
  const referenceSuffix = `_${filters.reference}`;
  const routeSuffix =
    filters.route_id === undefined
      ? ''
      : `_route-${filters.route_id}`;

  return `api_general_${downloadPeriod(filters)}_${filters.agency_id}${referenceSuffix}${routeSuffix}.csv`;
}

async function getDownloadMetadata( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<
  FastifyReply | {
    readonly filters: DownloadFilters;
    readonly rows: number;
    readonly message: string;
  }
> {
  try {
    const rows = await repository.countApiGeneralDownload(request.query);
    reply.header('Cache-Control', 'no-store');
    return {
      filters: request.query,
      rows,
      message: `This download contains ${rows.toLocaleString('en-US')} rows. Add /download to this URL to start generating the CSV file.`,
    };
  } catch (error) {
    throw new ServiceUnavailableError(
      'The database is temporarily unavailable',
      { cause: error },
    );
  }
}

async function streamDownload( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<FastifyReply> {
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

async function streamJobDownload(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
  repository: PublicDataRepository,
): Promise<FastifyReply> {
  const filters = repository.getDownloadJobFilters(request.params.jobId);
  if (filters === undefined) {
    return reply.code(404).send({
      error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Download job not found' },
    });
  }

  const stream = await repository.createDownloadJobStream(request.params.jobId);
  return reply
    .code(200)
    .header('X-Row-Count', String(stream.rowCount))
    .header('Cache-Control', 'public, max-age=3600')
    .header(
      'Content-Disposition',
      `attachment; filename="${downloadFilename(filters)}"`,
    )
    .type('text/csv; charset=utf-8')
    .send(stream);
}

async function queueDownload(
  request: FastifyRequest<{ Querystring: DownloadFilters }>,
  reply: FastifyReply,
  repository: PublicDataRepository,
): Promise<FastifyReply> {
  const job = await repository.enqueueApiGeneralDownload(request.query);
  return reply.code(job.status === 'completed' ? 200 : 202).send({
    job_id: job.id,
    status: job.status,
    rows: job.rows,
    status_url: `${request.protocol}://${request.host}/disturbance/download/${job.id}`,
  });
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
    '/disturbance',
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
              downloadFilterHelpResponseSchema,
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
      if (Object.keys(request.query).length === 0) {
        return sendFilterHelp(reply);
      }

      if (isDownloadRequest(request)) {
        return queueDownload(request, reply, repository);
      }

      return getDownloadMetadata(request, reply, repository);
    },
  );

  app.get<{ Querystring: DownloadFilters }>(
    '/disturbance/download',
    {
      config: routeConfig,
      schema: {
        tags: ['Downloads'],
        summary: 'Download the filtered CSV',
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
    async (request, reply) => queueDownload(request, reply, repository),
  );

  app.get<{ Params: { jobId: string } }>(
    '/disturbance/download/:jobId',
    {
      config: routeConfig,
      schema: {
        tags: ['Downloads'],
        summary: 'Get the status or download a generated CSV',
        params: {
          type: 'object',
          required: ['jobId'],
          properties: { jobId: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const job = repository.getDownloadJob(request.params.jobId);
      if (job === undefined) {
        return reply.code(404).send({
          error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Download job not found' },
        });
      }
      if (job.status !== 'completed') {
        return reply.code(job.status === 'failed' ? 500 : 202).send({
          job_id: job.id,
          status: job.status,
          rows: job.rows,
          error: job.error,
        });
      }

      return streamJobDownload(request, reply, repository);
    },
  );

}
