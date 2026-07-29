/**
 * Types and service for listing available data months grouped by agency,
 * reference, and disturbance class.
 * 
 * - `availableResponse`: Response shape for available months endpoint.
 * - `AvailableService`: Handles listing and caching available data.
 * - `groupAvailable`: Groups flat rows into hierarchical shape
 *   (month → agency → references and disturbance classes).
 */

import type { availableAgency, availableMonth, availableRow } from './consts.js';
import type { PublicDataRepository } from '../database/repository.js';

interface AvailableAgencyValues {
  readonly disturbanceClasses: Set<string>;
  readonly references: Set<string>;
}

/**
 * Response format for the available months API.
 * - `data`: Grouped available data, by month and agency.
 * - `generated_at`: When the response was generated (ISO 8601).
 */
export interface availableResponse {
  readonly data: readonly availableMonth[];
  readonly generated_at: string;
}

/** Cache entry for available data list */
interface AvailableCacheEntry {
  readonly expiresAt: number;
  readonly response: availableResponse;
}

/**
 * Groups flat available rows into structure by month, then by agency.
 * 
 * @param rows Source rows, each containing yearmonth, agency, reference, and
 * disturbance class.
 * @returns Grouped month objects, each with agencies, references, and
 * disturbance classes.
 */
export function groupAvailable(rows: readonly availableRow[]): readonly availableMonth[] {
  // Map: yearmonth → Map(agency_id → references and disturbance classes)
  const months = new Map<string, Map<string, AvailableAgencyValues>>();

  for (const row of rows) {
    // Get or create agency mapping for this month
    let agencies = months.get(row.yearmonth);
    if (!agencies) {
      agencies = new Map();
      months.set(row.yearmonth, agencies);
    }

    // Get or create the available values for this agency in this month
    let values = agencies.get(row.agency_id);
    if (!values) {
      values = {
        disturbanceClasses: new Set(),
        references: new Set(),
      };
      agencies.set(row.agency_id, values);
    }

    values.disturbanceClasses.add(row.disturbance_class);
    values.references.add(row.reference);
  }

  // Convert nested maps to desired output structure
  return Array.from(months, ([yearmonth, agencies]) => ({
    agencies: Array.from(agencies, ([agency_id, values]): availableAgency => ({
      agency_id,
      disturbance_classes: Array.from(values.disturbanceClasses).sort(),
      references: Array.from(values.references).sort(),
    })),
    yearmonth,
  }));
}

/**
 * Service for retrieving, grouping, and caching available month/agency data.
 */
export class AvailableService {
  private cache: AvailableCacheEntry | undefined;
  private pending: Promise<availableResponse> | undefined;

  /**
   * @param repository Data repository to list available rows from.
   * @param cacheTtlMilliseconds Cache duration in milliseconds.
   */
  constructor(
    private readonly repository: PublicDataRepository,
    private readonly cacheTtlMilliseconds: number,
  ) {}

  /**
   * List available months grouped by agency and filtered by cache.
   * @returns Cached or fresh `availableResponse` data.
   */
  async list(): Promise<availableResponse> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.response;
    }

    if (this.pending) {
      return this.pending;
    }

    this.pending = this.refresh(now);

    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  /**
   * Fetches fresh available data, stores to cache, and returns grouped response.
   * 
   * @param now Timestamp when the request is made.
   */
  private async refresh(now: number): Promise<availableResponse> {
    // Note: Repository must provide `listAvailable` returning availableRow[]
    const rows = await this.repository.listAvailable();
    const response = {
      data: groupAvailable(rows),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };

    return response;
  }
}
