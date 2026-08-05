import { AGENCY_IDS, REFERENCE_TYPES } from './consts.js';

/* * */

export type AgencyId = (typeof AGENCY_IDS)[number];
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export type CsvRow = Record<string, string>;
