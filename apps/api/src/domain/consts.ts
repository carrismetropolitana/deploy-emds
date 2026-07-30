export const AGENCY_IDS = ['41', '42', '43', '44'] as const;
export const REFERENCE_TYPES = ['planned', 'freeflow'] as const;

export type AgencyId = (typeof AGENCY_IDS)[number];
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

interface DownloadBaseFilters {
  readonly agency_id: AgencyId;
  readonly disturbance_class?: string;
  readonly reference?: ReferenceType;
  readonly route_id?: string;
  readonly trip_id?: string;
}

interface DownloadSingleMonthFilter {
  readonly yearmonth: string;
  readonly yearmonth_from?: never;
  readonly yearmonth_to?: never;
}

interface DownloadMonthRangeFilter {
  readonly yearmonth?: never;
  readonly yearmonth_from: string;
  readonly yearmonth_to: string;
}

export type DownloadFilters = DownloadBaseFilters &
  (DownloadSingleMonthFilter | DownloadMonthRangeFilter);

export interface AvailableRow {
  readonly agency_id: string;
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
