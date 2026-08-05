import type { AgencyId } from '../types.js';
import type { AvailableRow } from './available.js';
import type {
  CsvDownloadStream,
  DownloadFilters,
  DownloadJob,
} from './download.js';

/* * */

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
