/**
 * List of supported operator area IDs (Carris Metropolitana)
 * Used for query validation and OpenAPI documentation in API endpoints.
 */
export const AGENCY_IDS = ['41', '42', '43', '44'] as const;

/**
 * List of valid reference data types.
 * "planned" = scheduled reference data.
 * "freeflow" = reference from observed/real-time data.
 */
export const REFERENCE_TYPES = ['planned', 'freeflow'] as const;

/**
 * Type for supported operator area IDs.
 */
export type AgencyId = (typeof AGENCY_IDS)[number];

/**
 * Type for valid reference data types.
 */
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

interface DownloadBaseFilters {
  /**
   * Operator agency/area ID. Must match one of {@link AgencyId}.
   */
  readonly agency_id: AgencyId;
  /**
   * Disturbance class to include (optional).
   */
  readonly disturbance_class?: string;
  /**
   * Reference type ("planned", "freeflow"). Optional – defaults to "planned".
   */
  readonly reference?: ReferenceType;
  /**
   * (Filter) Specific route within the agency/area (optional).
   */
  readonly route_id?: string;
}

interface DownloadSingleMonthFilter {
  /**
   * Requested period, in YYYYMM format, e.g. "202612" (required).
   */
  readonly yearmonth: string;
  readonly yearmonth_from?: never;
  readonly yearmonth_to?: never;
}

interface DownloadMonthRangeFilter {
  readonly yearmonth?: never;
  /** First requested month, inclusive, in YYYYMM format. */
  readonly yearmonth_from: string;
  /** Last requested month, inclusive, in YYYYMM format. */
  readonly yearmonth_to: string;
}

/**
 * Download parameter filters for times/delays data.
 * Accepts either one `yearmonth` or an inclusive `yearmonth_from`/`yearmonth_to`
 * range.
 */
export type DownloadFilters = DownloadBaseFilters &
  (DownloadSingleMonthFilter | DownloadMonthRangeFilter);

/**
 * Structure representing a single row/result of the API's "available" endpoint.
 * Lists a single yearmonth, reference type, and disturbance class for a specific
 * operator area.
 */
export interface availableRow {
  /** Operator agency/area ID. */
  readonly agency_id: string;
  /** Disturbance class available for the given agency/month. */
  readonly disturbance_class: string;
  /** Reference type available for the given agency/month. */
  readonly reference: string;
  /** Year and month (YYYYMM) for the available dataset. */
  readonly yearmonth: string;
}

/**
 * Distinct values currently available for every discoverable dataset field.
 */
export interface availableData {
  /** Years and months (YYYYMM). */
  readonly yearmonth: readonly string[];
  /** Operator agency/area IDs. */
  readonly agency_id: readonly string[];
  /** Reference types ("planned", "freeflow"). */
  readonly reference: readonly string[];
  /** Disturbance classes. */
  readonly disturbance_class: readonly string[];
}
