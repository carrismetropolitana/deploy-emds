export const AGENCY_IDS = ['41', '42', '43', '44'] as const;
export const REFERENCE_TYPES = ['planned', 'freeflow'] as const;

export type AgencyId = (typeof AGENCY_IDS)[number];
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export interface DownloadFilters {
  readonly agency_id: AgencyId;
  readonly reference?: ReferenceType;
  readonly route_id?: string;
  readonly yearmonth: string;
}

export interface availableRow {
  readonly agency_id: string;
  readonly reference: string;
  readonly yearmonth: string;
}

export interface availableAgency {
  readonly agency_id: string;
  readonly references: readonly string[];
}

export interface availableMonth {
  readonly agencies: readonly availableAgency[];
  readonly yearmonth: string;
}
