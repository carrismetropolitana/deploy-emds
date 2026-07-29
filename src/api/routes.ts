import type { Readable } from 'node:stream';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AvailableService } from './available.js';
import type { AppConfig } from '../config.js';
import { AGENCY_IDS, REFERENCE_TYPES, type DownloadFilters } from './consts.js';
import { ServiceUnavailableError } from './errors.js';
import type { PublicDataRepository } from '../database/repository.js';

interface RegisterRoutesOptions {
  readonly config: AppConfig;
  readonly repository: PublicDataRepository;
}

const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

const downloadQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['agency_id'],
  oneOf: [
    {
      required: ['yearmonth'],
      not: {
        anyOf: [
          { required: ['yearmonth_from'] },
          { required: ['yearmonth_to'] },
        ],
      },
    },
    {
      required: ['yearmonth_from', 'yearmonth_to'],
      not: { required: ['yearmonth'] },
    },
  ],
  properties: {
    yearmonth: {
      type: 'string',
      pattern: '^[0-9]{4}(0[1-9]|1[0-2])$',
      description: 'Completed month in YYYYMM format.',
      examples: ['202605'],
    },
    yearmonth_from: {
      type: 'string',
      pattern: '^[0-9]{4}(0[1-9]|1[0-2])$',
      description: 'First completed month in an inclusive YYYYMM range.',
      examples: ['202605'],
    },
    yearmonth_to: {
      type: 'string',
      pattern: '^[0-9]{4}(0[1-9]|1[0-2])$',
      description: 'Last completed month in an inclusive YYYYMM range.',
      examples: ['202606'],
    },
    agency_id: {
      type: 'string',
      enum: AGENCY_IDS,
      description: 'Carris Metropolitana operator area.',
    },
    disturbance_class: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description: 'Optional disturbance class.',
    },
    reference: {
      type: 'string',
      enum: REFERENCE_TYPES,
      description: 'Disturbance reference type.',
    },
    route_id: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]*$',
      description: 'Optional route identifier.',
      examples: ['1001_0'],
    },
  },
} as const;

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
    filters.route_id === undefined ? '' : `_route-${filters.route_id}`;
  return `api_general_${downloadPeriod(filters)}_${filters.agency_id}${referenceSuffix}${routeSuffix}.csv`;
}

async function createDownload(
  request: FastifyRequest<{ Querystring: DownloadFilters }>,
  reply: FastifyReply,
  repository: PublicDataRepository,
  cacheSeconds: number,
): Promise<FastifyReply> {
  if (
    request.query.yearmonth === undefined &&
    request.query.yearmonth_from > request.query.yearmonth_to
  ) {
    return reply.code(400).send({
      error: {
        code: 'INVALID_QUERY',
        message: 'yearmonth_from must be before or equal to yearmonth_to',
      },
    });
  }

  let stream: Readable;

  try {
    stream = await repository.createApiGeneralDownload(request.query);
  } catch (error) {
    throw new ServiceUnavailableError('The database is temporarily unavailable', {
      cause: error,
    });
  }

  stream.once('error', (error) => {
    request.log.error({ err: error }, 'CSV download stream failed');
  });

  const filename = downloadFilename(request.query);
  reply
    .code(200)
    .header('Cache-Control', `public, max-age=${cacheSeconds}`)
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .header('X-Accel-Buffering', 'no')
    .header('X-Content-Type-Options', 'nosniff')
    .type('text/csv; charset=utf-8');

  return reply.send(stream);
}

export async function registerRoutes(app: FastifyInstance, options: RegisterRoutesOptions): Promise<void> {
  const { config, repository } = options;
  const availableService = new AvailableService(repository, config.availableCacheSeconds * 1_000);
  const downloadRouteConfig = {
    rateLimit: {
      max: config.downloadRateLimitMax,
      timeWindow: 60_000,
    },
  };

  app.get(
    '/health',
    {
      schema: {
        hide: true,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: { status: { type: 'string' } },
          },
        },
      },
    },
    async () => ({ status: 'ok' }),
  );

  app.get(
    '/ready',
    {
      schema: {
        hide: true,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: { status: { type: 'string' } },
          },
          503: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        await repository.ping();
        return { status: 'ok' };
      } catch (error) {
        reply.code(503);
        throw new ServiceUnavailableError('The database is temporarily unavailable', {
          cause: error,
        });
      }
    },
  );

  app.get<{ Querystring: DownloadFilters }>(
    '/api',
    {
      config: downloadRouteConfig,
      schema: {
        tags: ['Downloads'],
        summary: 'Get filtered road-link data as CSV',
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
      createDownload(
        request,
        reply,
        repository,
        config.downloadCacheSeconds,
      ),
  );

  app.get(
    '/api/available',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List distinct values available for each dataset field',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data', 'generated_at'],
            properties: {
              generated_at: { type: 'string', format: 'date-time' },
              data: {
                type: 'object',
                additionalProperties: false,
                required: ['yearmonth', 'agency_id', 'reference', 'disturbance_class'],
                properties: {
                  yearmonth: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  agency_id: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  reference: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  disturbance_class: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
          503: errorSchema,
        },
      },
    },
    async () => {
      try {
        return await availableService.list();
      } catch (error) {
        throw new ServiceUnavailableError('The database is temporarily unavailable', {
          cause: error,
        });
      }
    },
  );
}
