import type { FastifyReply } from 'fastify';

export const PROJECT_DOCUMENTATION_URL =
  'https://github.com/carrismetropolitana/deploy-emds';

export const FILTER_HELP_RESPONSE = {
  message:
    'Welcome to the TML Carris Metropolitana disturbance dataset API for the Lisbon Metropolitan Area.',
  documentation: 'Please check https://github.com/carrismetropolitana/deploy-emds for endpoints documentation.',
} as const;

export function sendFilterHelp(reply: FastifyReply): FastifyReply {

  return reply
    .type('application/json; charset=utf-8')
    .send({
      ...FILTER_HELP_RESPONSE,
    });
}
