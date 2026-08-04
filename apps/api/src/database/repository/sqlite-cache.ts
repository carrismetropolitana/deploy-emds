import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';

import { parse } from '@fast-csv/parse';
import { CsvWriter } from '@tmlmobilidade/writers';

import type { AgencyId, AvailableRow, DownloadFilters } from '../../domain/consts.js';
import { SQLiteDownloadCache } from '../sqlite/download-cache.js';
import type { CsvDownloadStream, DownloadJob, PublicDataRepository } from './types.js';
import type { DownloadJobRecord } from '../sqlite/download-cache.js';

type CsvRow = Record<string, string>;

const PROGRESS_UPDATE_BATCH_SIZE = 1_000;

function cacheKey(filters: DownloadFilters): string {
  return JSON.stringify(
    Object.entries(filters).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

export class SQLiteCachedPublicDataRepository implements PublicDataRepository {
  private queueTimer: NodeJS.Timeout | undefined;
  private queueRunning = false;

  constructor(
    private readonly upstream: PublicDataRepository,
    private readonly cache: SQLiteDownloadCache,
  ) {}

  async close(): Promise<void> {
    try {
      this.stopQueue();
      await this.upstream.close();
    } finally {
      this.cache.close();
    }
  }

  startQueue(): void {
    if (this.queueTimer !== undefined) return;
    this.cache.recoverInterruptedJobs();
    this.queueTimer = setInterval(() => {
      void this.processNextJob();
    }, 250);
    void this.processNextJob();
  }

  stopQueue(): void {
    if (this.queueTimer !== undefined) {
      clearInterval(this.queueTimer);
      this.queueTimer = undefined;
    }
  }

  async enqueueApiGeneralDownload(filters: DownloadFilters): Promise<DownloadJob> {
    const key = cacheKey(filters);
    const existing = this.cache.getJobByCacheKey(key);
    if (existing !== undefined && existing.status !== 'failed') {
      return this.toDownloadJob(existing);
    }

    const rowCount = await this.upstream.countApiGeneralDownload(filters);
    const job = existing === undefined
      ? this.cache.createJob(randomUUID(), key, JSON.stringify(filters), rowCount)
      : this.cache.retryJob(existing.id, JSON.stringify(filters), rowCount);
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
    await unlink(filePath).catch(() => undefined);
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
