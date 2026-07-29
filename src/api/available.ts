/**
 * Types and service for listing distinct values available for each dataset
 * field.
 * 
 * - `availableResponse`: Response shape for the available data endpoint.
 * - `AvailableService`: Handles listing and caching available data.
 * - `organizeAvailable`: Organizes flat rows into arrays of distinct values.
 */

import type { availableData, availableRow } from './consts.js';
import type { PublicDataRepository } from '../database/repository.js';

/**
 * Response format for the available data API.
 * - `data`: Distinct values available for each dataset field.
 * - `generated_at`: When the response was generated (ISO 8601).
 */
export interface availableResponse {
  readonly data: availableData;
  readonly generated_at: string;
}

/** Cache entry for available data list */
interface AvailableCacheEntry {
  readonly expiresAt: number;
  readonly response: availableResponse;
}

/**
 * Organizes flat available rows into sorted arrays of distinct values.
 * 
 * @param rows Source rows, each containing yearmonth, agency, reference, and
 * disturbance class.
 * @returns Distinct available values grouped by field name.
 */
export function organizeAvailable(rows: readonly availableRow[]): availableData {
  const agencyIds = new Set<string>();
  const disturbanceClasses = new Set<string>();
  const references = new Set<string>();
  const yearmonths = new Set<string>();

  for (const row of rows) {
    agencyIds.add(row.agency_id);
    disturbanceClasses.add(row.disturbance_class);
    references.add(row.reference);
    yearmonths.add(row.yearmonth);
  }

  return {
    yearmonth: Array.from(yearmonths).sort(),
    agency_id: Array.from(agencyIds).sort(),
    reference: Array.from(references).sort(),
    disturbance_class: Array.from(disturbanceClasses).sort(),
  };
}

/**
 * Service for retrieving, organizing, and caching available data.
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
   * List distinct available values, using the cached response when valid.
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
      data: organizeAvailable(rows),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };

    return response;
  }
}
