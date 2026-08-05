import type { Readable } from 'node:stream';

import type { AgencyId, ReferenceType } from '../types.js';

/* * */

export interface DownloadFilters {
  readonly agency_id: AgencyId;
  readonly disturbance_class?: string;
  readonly reference: ReferenceType;
  readonly route_id?: string;
  readonly trip_id?: string;
  readonly yearmonth: string;
}

export interface DownloadJob {
  readonly id: string;
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
  readonly rows: number | null;
  readonly processed_rows: number;
  readonly remaining_rows: number;
  readonly error: string | null;
}

export interface CsvDownloadStream extends Readable {
  readonly rowCount: number;
}
