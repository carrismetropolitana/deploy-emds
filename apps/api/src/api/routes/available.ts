import type { FastifyInstance } from 'fastify';

import { ServiceUnavailableError } from '../errors.js';
import { AvailableService, AvailableValuesService } from '../services/availability.js';
import { availableAgencyParamsSchema, availableResponseSchema, availableValuesResponseSchema } from '../schemas/available.js';
import { errorSchema } from '../schemas/common.js';
import type { AvailableAgencyParams } from '../../types/interfaces/available.js';
import type { AvailableRoutesOptions } from '../../types/interfaces/routes.js';
import { createAgencyServices } from '../utils/create-agency-services.js';
import { getAgencyService } from '../utils/get-agency-service.js';
import { getAvailableValues } from '../utils/get-available-values.js';

/* * */

export function registerAvailableRoutes( app: FastifyInstance, options: AvailableRoutesOptions ): void {
  //
  // Extract the configuration and repository
  
  const { repository } = options;
  const cacheTtlMilliseconds = 300_000;

  //
  // Create the services

  const availableService = new AvailableService(
    repository,
    cacheTtlMilliseconds,
  );

  //
  // Create the routes service
  const routesService = new AvailableValuesService(
    () => repository.listAvailableRoutes(),
    cacheTtlMilliseconds,
  );

  //
  // Create the trips service
  const tripsService = new AvailableValuesService(
    () => repository.listAvailableTrips(),
    cacheTtlMilliseconds,
  );

  //
  // Create the routes by agency service
  const routesByAgency = createAgencyServices(
    (agencyId) => repository.listAvailableRoutes(agencyId),
    cacheTtlMilliseconds,
  );

  //
  // Create the trips by agency service
  const tripsByAgency = createAgencyServices(
    (agencyId) => repository.listAvailableTrips(agencyId),
    cacheTtlMilliseconds,
  );

  //
  // Register the routes

  app.get(
    '/disturbance/available',
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
    '/disturbance/available/routes',
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
    '/disturbance/available/trips',
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
    '/disturbance/available/routes/:agency_id',
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
    '/disturbance/available/trips/:agency_id',
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
