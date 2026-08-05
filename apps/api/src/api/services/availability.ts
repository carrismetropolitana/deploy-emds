import type { AvailableData, AvailableRow } from '../../types/interfaces/available.js';
import type { PublicDataRepository } from '../../types/interfaces/repository.js';

export interface AvailableResponse {
  readonly available_data: AvailableData;
  readonly generated_at: string;
}

export interface AvailableValuesResponse {
  readonly available_values: readonly string[];
  readonly generated_at: string;
}

interface CacheEntry<Response> {
  readonly expiresAt: number;
  readonly response: Response;
}

function organizeAvailable(rows: readonly AvailableRow[]): AvailableData {
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

export class AvailableService {
  private cache: CacheEntry<AvailableResponse> | undefined;
  private pending: Promise<AvailableResponse> | undefined;

  constructor(
    private readonly repository: PublicDataRepository,
    private readonly cacheTtlMilliseconds: number,
  ) {}

  async list(): Promise<AvailableResponse> {
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

  private async refresh(now: number): Promise<AvailableResponse> {
    const response = {
      available_data: organizeAvailable(
        await this.repository.listAvailable(),
      ),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };
    return response;
  }
}

export class AvailableValuesService {
  private cache: CacheEntry<AvailableValuesResponse> | undefined;
  private pending: Promise<AvailableValuesResponse> | undefined;

  constructor(
    private readonly loadValues: () => Promise<readonly string[]>,
    private readonly cacheTtlMilliseconds: number,
  ) {}

  async list(): Promise<AvailableValuesResponse> {
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

  private async refresh(
    now: number,
  ): Promise<AvailableValuesResponse> {
    const response = {
      available_values: await this.loadValues(),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };
    return response;
  }
}
