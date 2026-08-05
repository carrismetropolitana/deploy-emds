import type { DownloadFilters } from '../../types/interfaces/download.js';

/* * */

export function downloadPeriod(filters: DownloadFilters): string {
  return filters.yearmonth;
}

export function downloadFilename(filters: DownloadFilters): string {
  const referenceSuffix = `_${filters.reference}`;
  const routeSuffix =
    filters.route_id === undefined
      ? ''
      : `_route-${filters.route_id}`;

  return `api_general_${downloadPeriod(filters)}_${filters.agency_id}${referenceSuffix}${routeSuffix}.csv`;
}

export function downloadZipFilename(filters: DownloadFilters): string {
  return downloadFilename(filters).replace(/\.csv$/, '.zip');
}
