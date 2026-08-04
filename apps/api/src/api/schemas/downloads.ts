import { AGENCY_IDS, REFERENCE_TYPES } from '../../domain/consts.js';

export const downloadQuerySchema = {
  type: 'object',
  additionalProperties: false,
  oneOf: [
    {
      type: 'object',
      maxProperties: 0,
    },
    {
      type: 'object',
      required: ['yearmonth', 'agency_id', 'reference'],
    },
  ],
  properties: {
    yearmonth: {
      type: 'string',
      pattern: '^[0-9]{4}(0[1-9]|1[0-2])$',
      description: 'Completed month in YYYYMM format.',
      examples: ['202605'],
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
  required: ['filters', 'rows', 'message'],
  properties: {
    filters: downloadQuerySchema,
    rows: {
      type: 'integer',
      minimum: 0,
    },
    message: {
      type: 'string',
    },
  },
} as const;

export const downloadJobResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'job_id',
    'status',
    'rows',
    'processed_rows',
    'remaining_rows',
    'status_url',
  ],
  properties: {
    job_id: { type: 'string', minLength: 1 },
    status: {
      type: 'string',
      enum: ['queued', 'processing', 'completed', 'failed'],
    },
    rows: {
      anyOf: [
        { type: 'integer', minimum: 0 },
        { type: 'null' },
      ],
    },
    processed_rows: { type: 'integer', minimum: 0 },
    remaining_rows: { type: 'integer', minimum: 0 },
    status_url: { type: 'string', minLength: 1 },
  },
} as const;

export const downloadFilterHelpResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'available', 'documentation'],
  properties: {
    message: { type: 'string' },
    available: { type: 'string' },
    documentation: { type: 'string' },
  },
} as const;
