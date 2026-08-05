import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';

import { parse } from '@fast-csv/parse';
import { CsvWriter } from '@tmlmobilidade/writers';

import type { AvailableRow } from '../../types/interfaces/available.js';
import type { AgencyId, CsvRow } from '../../types/types.js';
import { SQLiteDownloadCache } from '../sqlite/download-cache.js';
import type { DownloadJobRecord, ExpiredDownloadJobRecord } from '../sqlite/download-cache.js';
import type {
  CsvDownloadStream,
  DownloadFilters,
  DownloadJob,
} from '../../types/interfaces/download.js';
import type { PublicDataRepository } from '../../types/interfaces/repository.js';
import { DOWNLOAD_CLEANUP_INTERVAL_MS, DOWNLOAD_RETENTION_MS, PROGRESS_UPDATE_BATCH_SIZE } from '../../types/consts.js';

/* * */

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function serializeFilters(filters: DownloadFilters): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(filters).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

export class SQLiteCachedPublicDataRepository implements PublicDataRepository {
  private cleanupPromise: Promise<number> | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;
  private queueTimer: NodeJS.Timeout | undefined;
  private queueRunning = false;

  constructor(
    private readonly upstream: PublicDataRepository,
    private readonly cache: SQLiteDownloadCache,
  ) {}

  async close(): Promise<void> {
    try {
      this.stopQueue();
      await this.cleanupPromise;
      await this.upstream.close();
    } finally {
      this.cache.close();
    }
  }

  startQueue(): void {
    if (this.queueTimer !== undefined) return;

    // Keep generated CSVs for seven days. Cleanup runs once immediately and
    // then every hour so old files do not accumulate between requests.
    this.cleanupTimer = setInterval(() => {
      this.runExpiredDownloadCleanup();
    }, DOWNLOAD_CLEANUP_INTERVAL_MS);
    this.queueTimer = setInterval(() => {
      void this.processNextJob();
    }, 250);
    this.runExpiredDownloadCleanup();
    void this.processNextJob();
  }

  stopQueue(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    if (this.queueTimer !== undefined) {
      clearInterval(this.queueTimer);
      this.queueTimer = undefined;
    }
  }

  async cleanupExpiredDownloads(now = Date.now()): Promise<number> {
    if (this.cleanupPromise !== undefined) {
      return this.cleanupPromise;
    }

    const operation = this.removeExpiredDownloads(
      this.cache.listExpiredCompletedJobs(now - DOWNLOAD_RETENTION_MS),
    );
    this.cleanupPromise = operation;
    try {
      return await operation;
    } finally {
      this.cleanupPromise = undefined;
    }
  }

  private runExpiredDownloadCleanup(): void {
    void this.cleanupExpiredDownloads().catch((error: unknown) => {
      console.error('[SQLITE] Download cleanup failed:', error);
    });
  }

  private async removeExpiredDownloads(
    jobs: readonly ExpiredDownloadJobRecord[],
  ): Promise<number> {
    let removed = 0;
    for (const job of jobs) {
      if (job.file_path !== null) {
        try {
          // Remove the CSV before its SQLite row so a failed filesystem
          // operation leaves the job available for a later cleanup attempt.
          await unlink(job.file_path);
        } catch (error) {
          if (!isMissingFileError(error)) {
            continue;
          }
        }
      }
      this.cache.deleteCompletedJob(job.id);
      removed += 1;
    }
    return removed;
  }

  async enqueueApiGeneralDownload(filters: DownloadFilters): Promise<DownloadJob> {
    const serializedFilters = serializeFilters(filters);
    const rowCount = await this.upstream.countApiGeneralDownload(filters);

    /*
     * Disabled while the source database is in beta. Keep this filter-based
     * reuse flow here so it can be re-enabled when the source data is stable.
     *
     * const existing = this.cache.getJobByFilters(serializedFilters);
     * if (existing !== undefined && existing.status !== 'failed') {
     *   return this.toDownloadJob(existing);
     * }
     *
     * const latest = this.cache.getJobByFilters(serializedFilters);
     * if (latest !== undefined) {
     *   if (latest.status !== 'failed') {
     *     return this.toDownloadJob(latest);
     *   }
     *   return this.toDownloadJob(
     *     this.cache.retryJob(latest.id, serializedFilters, rowCount),
     *   );
     * }
     *
     * try {
     *   const job = this.cache.createJob(
     *     randomUUID(),
     *     randomUUID(),
     *     serializedFilters,
     *     rowCount,
     *   );
     *   return this.toDownloadJob(job);
     * } catch (error) {
     *   const concurrent = this.cache.getJobByFilters(serializedFilters);
     *   if (concurrent !== undefined && concurrent.status !== 'failed') {
     *     return this.toDownloadJob(concurrent);
     *   }
     *   throw error;
     * }
     */

    // The source database is still in beta. Do not reuse a job by matching
    // filters: every request must query the source and receive a new job_id
    // with its own CSV file for comparison and troubleshooting.
    const job = this.cache.createJob(
      randomUUID(),
      randomUUID(),
      serializedFilters,
      rowCount,
    );
    return this.toDownloadJob(job);
  }

  getDownloadJob(id: string): DownloadJob | undefined {
    const job = this.cache.getJob(id);
    return job === undefined ? undefined : this.toDownloadJob(job);
  }

  getDownloadJobFilters(id: string): DownloadFilters | undefined {
    const job = this.cache.getJob(id);
    return job === undefined ? undefined : JSON.parse(job.filters) as DownloadFilters;
  }

  async createDownloadJobStream(id: string): Promise<CsvDownloadStream> {
    const job = this.cache.getJob(id);
    if (job?.file_path === null || job?.file_path === undefined) {
      throw new Error('Download file is not ready');
    }
    const stream = createReadStream(job.file_path) as unknown as CsvDownloadStream;
    Object.defineProperty(stream, 'rowCount', { value: job.row_count ?? 0 });
    return stream;
  }

  async countApiGeneralDownload(
    filters: DownloadFilters,
  ): Promise<number> {
    return this.upstream.countApiGeneralDownload(filters);
  }

  async createApiGeneralDownload(
    _filters: DownloadFilters,
  ): Promise<CsvDownloadStream> {
    throw new Error('Downloads must be created through the queue');
  }

  private async processNextJob(): Promise<void> {
    if (this.queueRunning) return;
    const job = this.cache.claimNextJob();
    if (job === undefined) return;

    this.queueRunning = true;
    try {
      const generated = await this.generateDownload(job);
      // The generator only returns after writer.flush() succeeds. Mark the
      // job completed only after the complete CSV is safely written.
      this.cache.completeJob(job.id, generated.rowCount, generated.filePath);
    } catch (error) {
      this.cache.failJob(job.id, error);
    } finally {
      this.queueRunning = false;
    }
  }

  private async generateDownload(
    job: DownloadJobRecord,
  ): Promise<{ readonly filePath: string; readonly rowCount: number }> {
    const filters = JSON.parse(job.filters) as DownloadFilters;
    const rowCount = await this.upstream.countApiGeneralDownload(filters);
    const source = await this.upstream.createApiGeneralDownload(filters);
    const filePath = this.cache.jobFilePath(job.id);
    const writer = new CsvWriter('deploy-emds-download', filePath, {
      batch_size: 10_000,
      logs: false,
    });

    try {
      const parser = source.pipe(parse({ headers: true, ignoreEmpty: true }));
      let sequence = 0;
      for await (const row of parser as AsyncIterable<CsvRow>) {
        await writer.write(row);
        sequence += 1;
        if (sequence % PROGRESS_UPDATE_BATCH_SIZE === 0) {
          this.cache.updateProgress(job.id, sequence);
        }
      }
      this.cache.updateProgress(job.id, sequence);
      if (sequence === 0) {
        await writer.write({});
      }
      await writer.flush();
      return { filePath, rowCount };
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  private toDownloadJob(job: DownloadJobRecord): DownloadJob {
    return {
      id: job.id,
      status: job.status,
      rows: job.row_count,
      processed_rows: job.processed_rows,
      remaining_rows: Math.max((job.row_count ?? 0) - job.processed_rows, 0),
      error: job.error_message,
    };
  }


  async listAvailable(): Promise<readonly AvailableRow[]> {
    return this.upstream.listAvailable();
  }

  async listAvailableRoutes(
    agencyId?: AgencyId,
  ): Promise<readonly string[]> {
    return this.upstream.listAvailableRoutes(agencyId);
  }

  async listAvailableTrips(
    agencyId?: AgencyId,
  ): Promise<readonly string[]> {
    return this.upstream.listAvailableTrips(agencyId);
  }

  async ping(): Promise<void> {
    await this.upstream.ping();
    this.cache.ping();
  }
}
