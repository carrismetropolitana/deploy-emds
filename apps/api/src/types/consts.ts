export const AGENCY_IDS = ['41', '42', '43', '44'] as const;
export const REFERENCE_TYPES = ['planned', 'freeflow'] as const;

/* * */

export const SQL_IDENTIFIER_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/; // Valid PostgreSQL identifier path pattern
export const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/; // Valid PostgreSQL identifier pattern

/* * */

export const PROGRESS_UPDATE_BATCH_SIZE = 1_000;
export const DOWNLOAD_CLEANUP_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour
export const DOWNLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

/* * */

export const DOWNLOAD_SUFFIX = '/download';