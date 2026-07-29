import type { FastifyInstance } from 'fastify';

import type { PublicDataRepository } from '../../database/repository/types.js';
import { ServiceUnavailableError } from '../errors.js';
import { errorSchema, statusSchema } from '../schemas/common.js';

export function registerSystemRoutes(
  app: FastifyInstance,
  repository: PublicDataRepository,
): void {
  app.get(
    '/health',
    {
      schema: {
        hide: true,
        response: { 200: statusSchema },
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
          200: statusSchema,
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
        throw new ServiceUnavailableError(
          'The database is temporarily unavailable',
          { cause: error },
        );
      }
    },
  );
}
