import type { Readable } from 'node:stream';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { to as copyTo } from 'pg-copy-streams';

import type { AgencyId, AvailableRow, DownloadFilters } from '../../domain/consts.js';
import { buildAvailableRoutesSql, buildAvailableSql, buildAvailableTripsSql } from '../sql/available.js';
import { buildApiGeneralCountSql, buildApiGeneralCopySql } from '../sql/downloads.js';
import type { DatabaseIdentifiers } from '../sql/types.js';
import type { CsvDownloadStream, DownloadJob, PublicDataRepository } from './types.js';

interface DatabaseAvailableRow extends QueryResultRow, AvailableRow {}

interface DatabaseAvailableValueRow extends QueryResultRow {
  readonly value: string;
}

interface DatabaseCountRow extends QueryResultRow {
  readonly count: string;
}

export class PostgresPublicDataRepository implements PublicDataRepository {
  constructor(
    private readonly pool: Pool,
    private readonly identifiers: DatabaseIdentifiers,
  ) {}

  async close(): Promise<void> {
    await this.pool.end();
  }

  startQueue(): void {}

  stopQueue(): void {}

  async enqueueApiGeneralDownload(): Promise<DownloadJob> {
    throw new Error('Download queue is only available on the SQLite repository');
  }

  getDownloadJob(): DownloadJob | undefined {
    return undefined;
  }

  getDownloadJobFilters(): DownloadFilters | undefined {
    return undefined;
  }

  async createDownloadJobStream(): Promise<CsvDownloadStream> {
    throw new Error('Download queue is only available on the SQLite repository');
  }

  async countApiGeneralDownload(
    filters: DownloadFilters,
  ): Promise<number> {
    const result = await this.pool.query<DatabaseCountRow>(
      buildApiGeneralCountSql(filters, this.identifiers),
    );
    const count = Number(result.rows[0]?.count);

    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('Database returned an invalid row count');
    }

    return count;
  }

  async createApiGeneralDownload(
    filters: DownloadFilters,
  ): Promise<CsvDownloadStream> {
    return this.createCopyStream(
      buildApiGeneralCopySql(filters, this.identifiers),
    );
  }

  async listAvailable(): Promise<readonly AvailableRow[]> {
    const result = await this.pool.query<DatabaseAvailableRow>(
      buildAvailableSql(this.identifiers),
    );
    return result.rows;
  }

  async listAvailableRoutes(
    agencyId?: AgencyId,
  ): Promise<readonly string[]> {
    return this.listAvailableValues(
      buildAvailableRoutesSql(this.identifiers, agencyId),
    );
  }

  async listAvailableTrips(
    agencyId?: AgencyId,
  ): Promise<readonly string[]> {
    return this.listAvailableValues(
      buildAvailableTripsSql(this.identifiers, agencyId),
    );
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  private async createCopyStream(sql: string): Promise<CsvDownloadStream> {
    const client = await this.pool.connect();

    try {
      const stream = client.query(copyTo(sql));
      this.releaseClientWhenFinished(client, stream);
      return stream;
    } catch (error) {
      client.release(error instanceof Error ? error : true);
      throw error;
    }
  }

  private async listAvailableValues(
    sql: string,
  ): Promise<readonly string[]> {
    const result =
      await this.pool.query<DatabaseAvailableValueRow>(sql);
    return result.rows.map((row) => row.value);
  }

  private releaseClientWhenFinished(
    client: PoolClient,
    stream: Readable,
  ): void {
    let released = false;

    const release = (error?: Error): void => {
      if (!released) {
        released = true;
        client.release(error);
      }
    };

    stream.once('end', () => release());
    stream.once('close', () => release());
    stream.once('error', (error: Error) => release(error));
  }
}
