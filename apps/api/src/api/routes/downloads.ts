import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { PublicDataRepository } from '../../types/interfaces/repository.js';
import type { DownloadFilters, DownloadJob } from '../../types/interfaces/download.js';
import type { DownloadRoutesOptions } from '../../types/interfaces/routes.js';
import { DOWNLOAD_SUFFIX } from '../../types/consts.js';

import { ServiceUnavailableError } from '../errors.js';
import { errorSchema } from '../schemas/common.js';
import { downloadFilterHelpResponseSchema, downloadJobResponseSchema, downloadMetadataResponseSchema, downloadQuerySchema } from '../schemas/downloads.js';
import { sendFilterHelp } from '../welcome.js';
import { createZipStream } from '../utils/create-zip-stream.js';
import { downloadFilename, downloadZipFilename } from '../utils/download-filename.js';
import { finalizeZipStream } from '../utils/finalize-zip-stream.js';
import { isDownloadRequest } from '../utils/is-download-request.js';

async function getDownloadMetadata( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<FastifyReply | {readonly filters: DownloadFilters; readonly rows: number; readonly message: string }> {
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

async function streamJobDownload( request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<FastifyReply> {
  const filters = repository.getDownloadJobFilters(request.params.jobId);
  if (filters === undefined) {
    return reply.code(404).send({
      error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Download job not found' },
    });
  }

  const stream = await repository.createDownloadJobStream(request.params.jobId);
  const archive = createZipStream(
    request,
    stream,
    downloadFilename(filters),
  );
  const response = reply
    .code(200)
    .header('X-Row-Count', String(stream.rowCount))
    .header('Cache-Control', 'public, max-age=3600')
    .header(
      'Content-Disposition',
      `attachment; filename="${downloadZipFilename(filters)}"`,
    )
    .header('X-Content-Type-Options', 'nosniff')
    .type('application/zip')
    .send(archive);
  finalizeZipStream(request, archive);
  return response;
}

async function queueDownload( request: FastifyRequest<{ Querystring: DownloadFilters }>, reply: FastifyReply, repository: PublicDataRepository ): Promise<FastifyReply> {
  let job: DownloadJob;
  try {
    job = await repository.enqueueApiGeneralDownload(request.query);
  } catch (error) {
    throw new ServiceUnavailableError(
      'The download service is temporarily unavailable',
      { cause: error },
    );
  }

  return reply.code(job.status === 'completed' ? 200 : 202).send({
    job_id: job.id,
    status: job.status,
    rows: job.rows,
    processed_rows: job.processed_rows,
    remaining_rows: job.remaining_rows,
    status_url: `https://${request.host}/disturbance/download/${job.id}`,
  });
}

export function registerDownloadRoutes( app: FastifyInstance, options: DownloadRoutesOptions ): void {
  const { repository } = options;
  const routeConfig = {
    rateLimit: {
      max: 10,
      timeWindow: 30_000,
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
        summary: 'Show metadata or download the filtered CSV as a ZIP archive',
        description:
          'Returns JSON metadata normally. Append /download after the query to download the CSV as a ZIP archive.',
        querystring: downloadQuerySchema,
        produces: ['application/json', 'application/zip'],
        response: {
          200: {
            oneOf: [
              downloadMetadataResponseSchema,
              downloadFilterHelpResponseSchema,
              downloadJobResponseSchema,
              {
                type: 'string',
                contentMediaType: 'application/zip',
                description: 'ZIP archive containing the CSV download.',
              },
            ],
          },
          202: downloadJobResponseSchema,
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
        summary: 'Create or reuse a filtered download job',
        querystring: downloadQuerySchema,
        produces: ['application/json'],
        response: {
          200: downloadJobResponseSchema,
          202: downloadJobResponseSchema,
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
          processed_rows: job.processed_rows,
          remaining_rows: job.remaining_rows,
          error: job.error,
        });
      }

      return streamJobDownload(request, reply, repository);
    },
  );

}
