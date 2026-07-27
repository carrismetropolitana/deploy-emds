import { Readable } from 'node:stream';

import type { AppConfig } from '../src/config.js';
import type { AvailabilityRow, DownloadFilters } from '../src/domain.js';
import type { PublicDataRepository } from '../src/repository.js';

export const testConfig: AppConfig = {
  apiTable: 'mobilidade.api_general',
  availabilityCacheSeconds: 300,
  databaseConnectionTimeoutMs: 10_000,
  databaseIdleTimeoutMs: 30_000,
  databaseJumpServer: undefined,
  databaseName: 'emds',
  databasePassword: undefined,
  databasePoolMax: 4,
  databasePort: 5_432,
  databaseSshPrivateKey: undefined,
  databaseSshUser: '',
  databaseSsl: false,
  databaseSslRejectUnauthorized: true,
  databaseTunnelHost: '127.0.0.1',
  databaseTunnelPort: 6_092,
  databaseUrl: 'postgresql://unused',
  databaseUser: '',
  downloadCacheSeconds: 3_600,
  downloadRateLimitMax: 100,
  host: '127.0.0.1',
  logLevel: 'silent',
  nodeEnv: 'test',
  port: 3_000,
  referenceColumn: 'reference_type',
  trustProxy: false,
};

export class FakePublicDataRepository implements PublicDataRepository {
  availability: readonly AvailabilityRow[] = [
    { agency_id: '41', reference: 'freeflow', yearmonth: '202605' },
    { agency_id: '41', reference: 'planned', yearmonth: '202605' },
  ];
  closed = false;
  apiGeneralFilters?: DownloadFilters;
  pingError?: Error;

  async close(): Promise<void> {
    this.closed = true;
  }

  async createApiGeneralDownload(filters: DownloadFilters): Promise<Readable> {
    this.apiGeneralFilters = filters;
    return Readable.from(['yearmonth,agency_id\n202605,41\n']);
  }

  async listAvailability(): Promise<readonly AvailabilityRow[]> {
    return this.availability;
  }

  async ping(): Promise<void> {
    if (this.pingError) {
      throw this.pingError;
    }
  }
}
