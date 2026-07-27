import type {AvailabilityAgency, AvailabilityMonth, AvailabilityRow} from './domain.js';
import type { PublicDataRepository } from './repository.js';

export interface AvailabilityResponse {
  readonly data: readonly AvailabilityMonth[];
  readonly generated_at: string;
}

interface AvailabilityCacheEntry {
  readonly expiresAt: number;
  readonly response: AvailabilityResponse;
}

export function groupAvailability(rows: readonly AvailabilityRow[]): readonly AvailabilityMonth[] {
  const months = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    let agencies = months.get(row.yearmonth);
    if (!agencies) {
      agencies = new Map();
      months.set(row.yearmonth, agencies);
    }

    let references = agencies.get(row.agency_id);
    if (!references) {
      references = new Set();
      agencies.set(row.agency_id, references);
    }

    references.add(row.reference);
  }

  return Array.from(months, ([yearmonth, agencies]) => ({
    agencies: Array.from(agencies, ([agency_id, references]): AvailabilityAgency => ({
      agency_id,
      references: Array.from(references).sort(),
    })),
    yearmonth,
  }));
}

export class AvailabilityService {
  private cache: AvailabilityCacheEntry | undefined;
  private pending: Promise<AvailabilityResponse> | undefined;

  constructor(
    private readonly repository: PublicDataRepository,
    private readonly cacheTtlMilliseconds: number,
  ) {}

  async list(): Promise<AvailabilityResponse> {
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

  private async refresh(now: number): Promise<AvailabilityResponse> {
    const rows = await this.repository.listAvailability();
    const response = {
      data: groupAvailability(rows),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };

    return response;
  }
}
