import type { AvailableValuesService } from '../../api/services/availability.js';
import type { AgencyId } from '../types.js';

export interface AvailableRow {
  readonly agency_id: AgencyId;
  readonly disturbance_class: string;
  readonly reference: string;
  readonly yearmonth: string;
}

export interface AvailableData {
  readonly agency_id: readonly string[];
  readonly disturbance_class: readonly string[];
  readonly reference: readonly string[];
  readonly yearmonth: readonly string[];
}

export interface AvailableAgencyParams {
  readonly agency_id: AgencyId;
}

export type AgencyServices = ReadonlyMap<AgencyId, AvailableValuesService>;
