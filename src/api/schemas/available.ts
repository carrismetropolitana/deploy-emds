import { AGENCY_IDS } from '../../domain/consts.js';

export const availableResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['available_data', 'generated_at'],
  properties: {
    generated_at: { type: 'string', format: 'date-time' },
    available_data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'yearmonth',
        'agency_id',
        'reference',
        'disturbance_class',
      ],
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
} as const;

export const availableValuesResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['available_values', 'generated_at'],
  properties: {
    generated_at: { type: 'string', format: 'date-time' },
    available_values: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

export const availableAgencyParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['agency_id'],
  properties: {
    agency_id: {
      type: 'string',
      enum: AGENCY_IDS,
      description: 'Carris Metropolitana operator area.',
    },
  },
} as const;
