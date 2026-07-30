import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import type { AppConfig } from '../config/index.js';
import type { PublicDataRepository } from '../database/repository/types.js';
import { ServiceUnavailableError } from './errors.js';
import { registerRoutes } from './routes/index.js';

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly logger?: false;
  readonly repository: PublicDataRepository;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, repository } = options;
  const logger =
    options.logger === false
      ? false
      : config.nodeEnv === 'development'
        ? {
            level: config.logLevel,
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
              },
            },
          }
        : { level: config.logLevel };

  const app = Fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    exposeHeadRoutes: false,
    logger,
    trustProxy: config.trustProxy,
  });

  await app.register(cors, {
    exposedHeaders: ['Content-Disposition'],
    methods: ['GET', 'OPTIONS'],
    origin: '*',
  });
  await app.register(rateLimit, { global: false });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'DeployEMDS Public Data API',
        description:
          'Open API for discovering and downloading monthly road-link datasets.',
        version: '1.0.0',
      },
      tags: [
        { name: 'Downloads', description: 'Stream filtered datasets as CSV.' },
        { name: 'Discovery', description: 'Discover data currently available.' },
      ],
    },
  });

  await registerRoutes(app, { repository });

  app.get(
    '/docs',
    {
      schema: {
        hide: true,
      },
    },
    async () => app.swagger(),
  );

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    const validation = error.validation;
    if (validation) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_QUERY',
          message: error.message,
        },
      });
    }

    if (error instanceof ServiceUnavailableError) {
      request.log.error({ err: error.cause }, error.message);
      return reply.code(503).send({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: error.message,
        },
      });
    }

    if (
      error.statusCode !== undefined &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code || 'REQUEST_ERROR',
          message: error.message,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  app.addHook('onClose', async () => {
    await repository.close();
  });

  return app;
}
