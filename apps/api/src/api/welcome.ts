import type { FastifyReply } from 'fastify';

export const PROJECT_DOCUMENTATION_URL =
  'https://github.com/carrismetropolitana/deploy-emds';

export const FILTER_HELP_RESPONSE = {
  message:
    'Welcome to the TML Carris Metropolitana disturbance dataset API for the Lisbon Metropolitan Area. Use the filters below to query the dataset.',
  endpoint: '/disturbance',
  required_filters: 'yearmonth, agency_id, and reference',
  optional_filters: 'disturbance_class, route_id, and trip_id',
  example:'/disturbance?yearmonth=202606&agency_id=41&reference=planned',
  available: 'To view the available values for the filters, please see /disturbance/available.',
  documentation: PROJECT_DOCUMENTATION_URL,
} as const;

export function sendFilterHelp(reply: FastifyReply): FastifyReply {
  return reply
    .type('application/json; charset=utf-8')
    .send(FILTER_HELP_RESPONSE);
}
