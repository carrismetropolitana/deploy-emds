import type { FastifyInstance } from 'fastify';

import type { PublicDataRepository } from '../../database/repository/types.js';
import { AGENCY_IDS, type AgencyId } from '../../domain/consts.js';
import { ServiceUnavailableError } from '../errors.js';
import { AvailableService, AvailableValuesService, type AvailableValuesResponse } from '../services/availability.js';
import { availableAgencyParamsSchema, availableResponseSchema, availableValuesResponseSchema } from '../schemas/available.js';
import { errorSchema } from '../schemas/common.js';

interface AvailableRoutesOptions {
  readonly repository: PublicDataRepository;
}

interface AvailableAgencyParams {
  readonly agency_id: AgencyId;
}

type AgencyServices = ReadonlyMap<AgencyId, AvailableValuesService>;

async function getAvailableValues(service: AvailableValuesService): Promise<AvailableValuesResponse> {
  try {
    return await service.list();
  } catch (error) {
    throw new ServiceUnavailableError(
      'The database is temporarily unavailable',
      { cause: error },
    );
  }
}

function getAgencyService( services: AgencyServices, agencyId: AgencyId ): AvailableValuesService {
  const service = services.get(agencyId);
  if (!service) {
    throw new Error(
      `Available values service is missing for agency ${agencyId}`,
    );
  }

  return service;
}

function createAgencyServices( loadValues: (agencyId: AgencyId) => Promise<readonly string[]>, cacheTtlMilliseconds: number ): AgencyServices {
  return new Map(
    AGENCY_IDS.map((agencyId) => [
      agencyId,
      new AvailableValuesService(
        () => loadValues(agencyId),
        cacheTtlMilliseconds,
      ),
    ]),
  );
}

export function registerAvailableRoutes( app: FastifyInstance, options: AvailableRoutesOptions ): void {
  //
  // Extract the configuration and repository
  
  const { repository } = options;
  const cacheTtlMilliseconds = 300_000;
  const availableService = new AvailableService(
    repository,
    cacheTtlMilliseconds,
  );
  const routesService = new AvailableValuesService(
    () => repository.listAvailableRoutes(),
    cacheTtlMilliseconds,
  );
  const tripsService = new AvailableValuesService(
    () => repository.listAvailableTrips(),
    cacheTtlMilliseconds,
  );
  const routesByAgency = createAgencyServices(
    (agencyId) => repository.listAvailableRoutes(agencyId),
    cacheTtlMilliseconds,
  );
  const tripsByAgency = createAgencyServices(
    (agencyId) => repository.listAvailableTrips(agencyId),
    cacheTtlMilliseconds,
  );

  app.get(
    '/api/available',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List distinct values available for each dataset field',
        response: {
          200: availableResponseSchema,
          503: errorSchema,
        },
      },
    },
    async () => {
      try {
        return await availableService.list();
      } catch (error) {
        throw new ServiceUnavailableError(
          'The database is temporarily unavailable',
          { cause: error },
        );
      }
    },
  );

  app.get(
    '/api/available/routes',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List available route IDs',
        response: {
          200: availableValuesResponseSchema,
          503: errorSchema,
        },
      },
    },
    async () => getAvailableValues(routesService),
  );

  app.get(
    '/api/available/trips',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List available trip IDs',
        response: {
          200: availableValuesResponseSchema,
          503: errorSchema,
        },
      },
    },
    async () => getAvailableValues(tripsService),
  );

  app.get<{ Params: AvailableAgencyParams }>(
    '/api/available/routes/:agency_id',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List available route IDs for an agency',
        params: availableAgencyParamsSchema,
        response: {
          200: availableValuesResponseSchema,
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) =>
      getAvailableValues(
        getAgencyService(routesByAgency, request.params.agency_id),
      ),
  );

  app.get<{ Params: AvailableAgencyParams }>(
    '/api/available/trips/:agency_id',
    {
      schema: {
        tags: ['Discovery'],
        summary: 'List available trip IDs for an agency',
        params: availableAgencyParamsSchema,
        response: {
          200: availableValuesResponseSchema,
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) =>
      getAvailableValues(
        getAgencyService(tripsByAgency, request.params.agency_id),
      ),
  );
}
