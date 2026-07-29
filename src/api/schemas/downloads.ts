import { AGENCY_IDS, REFERENCE_TYPES } from '../../domain/consts.js';

export const downloadQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['agency_id'],
  oneOf: [
    {
      type: 'object',
      required: ['yearmonth'],
      not: {
        type: 'object',
        anyOf: [
          {
            type: 'object',
            required: ['yearmonth_from'],
          },
          {
            type: 'object',
            required: ['yearmonth_to'],
          },
        ],
      },
    },
    {
      type: 'object',
      required: ['yearmonth_from', 'yearmonth_to'],
      not: {
        type: 'object',
        required: ['yearmonth'],
      },
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
    trip_id: {
      type: 'string',
      minLength: 1,
      maxLength: 256,
      description: 'Optional trip identifier.',
    },
  },
} as const;

export const downloadMetadataResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['filters', 'rows'],
  properties: {
    filters: downloadQuerySchema,
    rows: {
      type: 'integer',
      minimum: 0,
    },
  },
} as const;
