import { randomUUID } from 'node:crypto';
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
  readonly processed_rows: number;
  readonly error_message: string | null;
  readonly file_path: string | null;
}

interface StoredJobIdentity {
  readonly id: string;
  readonly cache_key: string;
  readonly filters: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeFiltersJson(filters: string): string {
  const parsed = JSON.parse(filters) as Record<string, string>;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(parsed).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
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
    try {
      this.database.databaseInstance.exec(
        'ALTER TABLE download_jobs ADD COLUMN processed_rows INTEGER NOT NULL DEFAULT 0',
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
        processed_rows INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        file_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_download_jobs_cache_key
        ON download_jobs(cache_key);
      CREATE INDEX IF NOT EXISTS idx_download_jobs_filters
        ON download_jobs(filters);
      CREATE INDEX IF NOT EXISTS idx_download_jobs_status
        ON download_jobs(status, created_at);
    `);

    this.normalizeStoredFilters();
    this.randomizeLegacyCacheKeys();

  }

  private normalizeStoredFilters(): void {
    const jobs = this.database.databaseInstance
      .prepare('SELECT id, filters FROM download_jobs')
      .all() as ReadonlyArray<{
        readonly id: string;
        readonly filters: string;
      }>;
    const update = this.database.databaseInstance.prepare(
      'UPDATE download_jobs SET filters = ?, updated_at = ? WHERE id = ?',
    );

    for (const job of jobs) {
      try {
        const normalized = normalizeFiltersJson(job.filters);
        if (normalized !== job.filters) {
          update.run(normalized, Date.now(), job.id);
        }
      } catch {
        // Keep malformed legacy rows readable so they can still be inspected.
      }
    }
  }

  private randomizeLegacyCacheKeys(): void {
    const jobs = this.database.databaseInstance
      .prepare('SELECT id, cache_key, filters FROM download_jobs')
      .all() as readonly StoredJobIdentity[];
    const update = this.database.databaseInstance.prepare(
      'UPDATE download_jobs SET cache_key = ?, updated_at = ? WHERE id = ?',
    );

    for (const job of jobs) {
      if (!UUID_PATTERN.test(job.cache_key)) {
        update.run(randomUUID(), Date.now(), job.id);
      }
    }
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

  createJob(
    id: string,
    cacheKey: string,
    filters: string,
    rowCount: number,
  ): DownloadJobRecord {
    const now = Date.now();
    this.database.databaseInstance
      .prepare(
        `INSERT INTO download_jobs
          (id, cache_key, filters, status, row_count, processed_rows, error_message, file_path, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', ?, 0, NULL, NULL, ?, ?)`,
      )
      .run(id, cacheKey, filters, rowCount, now, now);
    return this.getJob(id)!;
  }

  retryJob(id: string, filters: string, rowCount: number): DownloadJobRecord {
    this.database.databaseInstance
      .prepare(
        `UPDATE download_jobs
         SET filters = ?, status = 'queued', row_count = ?,
             processed_rows = 0, error_message = NULL, file_path = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(filters, rowCount, Date.now(), id);
    return this.getJob(id)!;
  }

  getJob(id: string): DownloadJobRecord | undefined {
    return this.database.databaseInstance
      .prepare('SELECT id, cache_key, filters, status, row_count, processed_rows, error_message, file_path FROM download_jobs WHERE id = ?')
      .get(id) as DownloadJobRecord | undefined;
  }

  getJobByFilters(filters: string): DownloadJobRecord | undefined {
    return this.database.databaseInstance
      .prepare('SELECT id, cache_key, filters, status, row_count, processed_rows, error_message, file_path FROM download_jobs WHERE filters = ? ORDER BY created_at LIMIT 1')
      .get(filters) as DownloadJobRecord | undefined;
  }

  claimNextJob(): DownloadJobRecord | undefined {
    const transaction = this.database.databaseInstance.transaction(() => {
      const job = this.database.databaseInstance
        .prepare(
          `SELECT id, cache_key, filters, status, row_count, processed_rows, error_message, file_path
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

  updateProgress(id: string, processedRows: number): void {
    this.database.databaseInstance
      .prepare(
        'UPDATE download_jobs SET processed_rows = ?, updated_at = ? WHERE id = ?',
      )
      .run(processedRows, Date.now(), id);
  }

  completeJob(id: string, rowCount: number, filePath: string): void {
    this.database.databaseInstance
      .prepare("UPDATE download_jobs SET status = 'completed', row_count = ?, processed_rows = ?, file_path = ?, updated_at = ? WHERE id = ?")
      .run(rowCount, rowCount, filePath, Date.now(), id);
  }

  failJob(id: string, error: unknown): void {
    this.database.databaseInstance
      .prepare("UPDATE download_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
      .run(error instanceof Error ? error.message : String(error), Date.now(), id);
  }

}
