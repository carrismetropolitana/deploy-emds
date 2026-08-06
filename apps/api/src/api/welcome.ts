import type { FastifyReply } from 'fastify';

export const PROJECT_DOCUMENTATION_URL =
  'https://github.com/carrismetropolitana/deploy-emds';

export const FILTER_HELP_RESPONSE = {
  message:
    'Welcome to the TML Carris Metropolitana disturbance dataset API for the Lisbon Metropolitan Area. Use the filters below to query the dataset.',
  documentation: 'Please check https://github.com/carrismetropolitana/deploy-emds for endpoints documentation.',
} as const;

export function sendFilterHelp(reply: FastifyReply): FastifyReply {
  const baseUrl = `${reply.request.protocol}://${reply.request.host}`;

  return reply
    .type('application/json; charset=utf-8')
    .send({
      ...FILTER_HELP_RESPONSE,
      available: `To view the available values for the filters, please see ${baseUrl}/disturbance/available.`,
    });
}
