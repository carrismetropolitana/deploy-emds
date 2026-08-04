import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SQLiteDatabase } from '@tmlmobilidade/sqlite';

export type DownloadJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface DownloadJobRecord {
  readonly id: string;
  readonly cache_key: string;
  readonly filters: string;
  readonly status: DownloadJobStatus;
  readonly row_count: number | null;
  readonly error_message: string | null;
  readonly file_path: string | null;
}

export class SQLiteDownloadCache {
  private readonly database: SQLiteDatabase;
  private readonly databasePath: string;

  constructor() {
    const repositoryDatabasePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../data/jobs_queue.sqlite',
    );
    const databasePath =
      process.env.DOWNLOAD_CACHE_PATH?.trim() || repositoryDatabasePath;
    this.databasePath = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });

    console.log(`[SQLITE] Database path: ${databasePath}`);

    this.database = new SQLiteDatabase({ instancePath: databasePath });
    this.database.databaseInstance.exec(`
      DROP TABLE IF EXISTS download_cache_rows_v2;
      DROP TABLE IF EXISTS download_cache_metadata_v2;
    `);
    try {
      this.database.databaseInstance.exec(
        'ALTER TABLE download_jobs ADD COLUMN file_path TEXT',
      );
    } catch {
      // The column already exists on a current database.
    }
    this.database.databaseInstance.exec(`
      CREATE TABLE IF NOT EXISTS download_jobs (
        id TEXT PRIMARY KEY,
        cache_key TEXT NOT NULL,
        filters TEXT NOT NULL,
        status TEXT NOT NULL,
        row_count INTEGER,
        error_message TEXT,
        file_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_download_jobs_cache_key
        ON download_jobs(cache_key);
      CREATE INDEX IF NOT EXISTS idx_download_jobs_status
        ON download_jobs(status, created_at);
    `);

  }

  close(): void {
    this.database.databaseInstance.close();
  }

  ping(): void {
    this.database.databaseInstance.prepare('SELECT 1').get();
  }

  jobFilePath(jobId: string): string {
    const directory = join(dirname(this.databasePath), 'downloads');
    mkdirSync(directory, { recursive: true });
    return join(directory, `${jobId}.csv`);
  }

  createJob(id: string, cacheKey: string, filters: string): DownloadJobRecord {
    const now = Date.now();
    this.database.databaseInstance
      .prepare(
        `INSERT INTO download_jobs
          (id, cache_key, filters, status, row_count, error_message, file_path, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', NULL, NULL, NULL, ?, ?)`,
      )
      .run(id, cacheKey, filters, now, now);
    return this.getJob(id)!;
  }

  retryJob(id: string, filters: string): DownloadJobRecord {
    this.database.databaseInstance
      .prepare(
        `UPDATE download_jobs
         SET filters = ?, status = 'queued', row_count = NULL,
             error_message = NULL, file_path = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(filters, Date.now(), id);
    return this.getJob(id)!;
  }

  getJob(id: string): DownloadJobRecord | undefined {
    return this.database.databaseInstance
      .prepare('SELECT id, cache_key, filters, status, row_count, error_message, file_path FROM download_jobs WHERE id = ?')
      .get(id) as DownloadJobRecord | undefined;
  }

  getJobByCacheKey(cacheKey: string): DownloadJobRecord | undefined {
    return this.database.databaseInstance
      .prepare('SELECT id, cache_key, filters, status, row_count, error_message, file_path FROM download_jobs WHERE cache_key = ?')
      .get(cacheKey) as DownloadJobRecord | undefined;
  }

  claimNextJob(): DownloadJobRecord | undefined {
    const transaction = this.database.databaseInstance.transaction(() => {
      const job = this.database.databaseInstance
        .prepare(
          `SELECT id, cache_key, filters, status, row_count, error_message, file_path
           FROM download_jobs
           WHERE status = 'queued'
           ORDER BY created_at
           LIMIT 1`,
        )
        .get() as DownloadJobRecord | undefined;
      if (job === undefined) return undefined;

      this.database.databaseInstance
        .prepare("UPDATE download_jobs SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'queued'")
        .run(Date.now(), job.id);
      return this.getJob(job.id);
    });

    return transaction();
  }

  completeJob(id: string, rowCount: number, filePath: string): void {
    this.database.databaseInstance
      .prepare("UPDATE download_jobs SET status = 'completed', row_count = ?, file_path = ?, updated_at = ? WHERE id = ?")
      .run(rowCount, filePath, Date.now(), id);
  }

  failJob(id: string, error: unknown): void {
    this.database.databaseInstance
      .prepare("UPDATE download_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
      .run(error instanceof Error ? error.message : String(error), Date.now(), id);
  }

}
