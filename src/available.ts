import type {availableAgency, availableMonth, availableRow} from './domain.js';
import type { PublicDataRepository } from './repository.js';

export interface availableResponse {
  readonly data: readonly availableMonth[];
  readonly generated_at: string;
}

interface availableCacheEntry {
  readonly expiresAt: number;
  readonly response: availableResponse;
}

export function groupavailable(rows: readonly availableRow[]): readonly availableMonth[] {
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
    agencies: Array.from(agencies, ([agency_id, references]): availableAgency => ({
      agency_id,
      references: Array.from(references).sort(),
    })),
    yearmonth,
  }));
}

export class AvailableService {
  private cache: availableCacheEntry | undefined;
  private pending: Promise<availableResponse> | undefined;

  constructor(
    private readonly repository: PublicDataRepository,
    private readonly cacheTtlMilliseconds: number,
  ) {}

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

  private async refresh(now: number): Promise<availableResponse> {
    const rows = await this.repository.listavailable();
    const response = {
      data: groupavailable(rows),
      generated_at: new Date(now).toISOString(),
    };

    this.cache = {
      expiresAt: now + this.cacheTtlMilliseconds,
      response,
    };

    return response;
  }
}
