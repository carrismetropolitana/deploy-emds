import type { Readable } from 'node:stream';

import type { AgencyId, AvailableRow, DownloadFilters } from '../../domain/consts.js';

export interface DownloadJob {
  readonly id: string;
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
  readonly rows: number | null;
  readonly error: string | null;
}

export interface CsvDownloadStream extends Readable {
  readonly rowCount: number;
}

export interface PublicDataRepository {
  startQueue(): void;
  stopQueue(): void;
  enqueueApiGeneralDownload(filters: DownloadFilters): Promise<DownloadJob>;
  getDownloadJob(id: string): DownloadJob | undefined;
  getDownloadJobFilters(id: string): DownloadFilters | undefined;
  createDownloadJobStream(id: string): Promise<CsvDownloadStream>;
  close(): Promise<void>;
  countApiGeneralDownload(filters: DownloadFilters): Promise<number>;
  createApiGeneralDownload(filters: DownloadFilters): Promise<CsvDownloadStream>;
  listAvailable(): Promise<readonly AvailableRow[]>;
  listAvailableRoutes(agencyId?: AgencyId): Promise<readonly string[]>;
  listAvailableTrips(agencyId?: AgencyId): Promise<readonly string[]>;
  ping(): Promise<void>;
}
