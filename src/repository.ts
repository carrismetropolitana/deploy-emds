import type { Readable } from 'node:stream';

import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { to as copyTo } from 'pg-copy-streams';

import type { availableRow, DownloadFilters } from './domain.js';
import { buildavailableSql, buildApiGeneralCopySql, type DatabaseIdentifiers } from './sql.js';

export interface PublicDataRepository {
  close(): Promise<void>;
  createApiGeneralDownload(filters: DownloadFilters): Promise<Readable>;
  listavailable(): Promise<readonly availableRow[]>;
  ping(): Promise<void>;
}

interface DatabaseavailableRow extends QueryResultRow, availableRow {}

export class PostgresPublicDataRepository implements PublicDataRepository {
  constructor(
    private readonly pool: Pool,
    private readonly identifiers: DatabaseIdentifiers,
  ) {}

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createApiGeneralDownload(filters: DownloadFilters): Promise<Readable> {
    return this.createCopyStream(buildApiGeneralCopySql(filters, this.identifiers));
  }

  async listavailable(): Promise<readonly availableRow[]> {
    const result = await this.pool.query<DatabaseavailableRow>(
      buildavailableSql(this.identifiers),
    );
    return result.rows;
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  private async createCopyStream(sql: string): Promise<Readable> {
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

  private releaseClientWhenFinished(client: PoolClient, stream: Readable): void {
    let released = false;

    const release = (error?: Error): void => {
      if (released) {
        return;
      }

      released = true;
      client.release(error);
    };

    stream.once('end', () => release());
    stream.once('close', () => release());
    stream.once('error', (error: Error) => release(error));
  }
}
