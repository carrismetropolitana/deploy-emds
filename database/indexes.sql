-- Run each CREATE INDEX outside a transaction during a low-traffic window.
-- If DB_REFERENCE_COLUMN is not "reference_type", adjust this script first.

CREATE INDEX CONCURRENTLY IF NOT EXISTS api_general_public_api_idx
  ON mobilidade.api_general
  (yearmonth, agency_id, reference_type, route_id);
