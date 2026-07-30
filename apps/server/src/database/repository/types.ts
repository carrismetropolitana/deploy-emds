import type { Readable } from 'node:stream';

import type { AgencyId, AvailableRow, DownloadFilters } from '../../domain/consts.js';

export interface CsvDownloadStream extends Readable {
  readonly rowCount: number;
}

export interface PublicDataRepository {
  close(): Promise<void>;
  countApiGeneralDownload(filters: DownloadFilters): Promise<number>;
  createApiGeneralDownload(filters: DownloadFilters): Promise<CsvDownloadStream>;
  listAvailable(): Promise<readonly AvailableRow[]>;
  listAvailableRoutes(agencyId?: AgencyId): Promise<readonly string[]>;
  listAvailableTrips(agencyId?: AgencyId): Promise<readonly string[]>;
  ping(): Promise<void>;
}
