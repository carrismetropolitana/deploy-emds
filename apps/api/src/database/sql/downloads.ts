import type { DownloadFilters } from '../../domain/consts.js';
import { quoteIdentifier, quoteIdentifierPath, sqlLiteral } from './helpers.js';
import type { DatabaseIdentifiers } from './types.js';

function buildFilterConditions( alias: string, filters: DownloadFilters, referenceColumn: string ): string[] {
  //
  // Build the SQL conditions for the filters
  
  const conditions = [
    `${alias}."agency_id" = ${sqlLiteral(filters.agency_id)}`,
  ];

  conditions.unshift(
    `${alias}."yearmonth" = ${sqlLiteral(filters.yearmonth)}`,
  );

  conditions.push(
    `${alias}.${quoteIdentifier(referenceColumn)} = ${sqlLiteral(filters.reference)}`,
  );

  if (filters.disturbance_class !== undefined) {
    conditions.push(
      `${alias}."disturbance_class" = ${sqlLiteral(filters.disturbance_class)}`,
    );
  }

  if (filters.route_id !== undefined) {
    conditions.push(
      `${alias}."route_id" = ${sqlLiteral(filters.route_id)}`,
    );
  }

  if (filters.trip_id !== undefined) {
    conditions.push(
      `${alias}."trip_id" = ${sqlLiteral(filters.trip_id)}`,
    );
  }

  return conditions;
}

export function buildApiGeneralCopySql( filters: DownloadFilters, identifiers: DatabaseIdentifiers ): string {
  //
  // Build the SQL query to copy the API general data
  
  const table = quoteIdentifierPath(identifiers.apiTable);
  const conditions = buildFilterConditions(
    'a',
    filters,
    identifiers.referenceColumn,
  );

  return `COPY (
  SELECT a.*
  FROM ${table} AS a
  WHERE ${conditions.join('\n    AND ')}
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8')`;
}

export function buildApiGeneralCountSql( filters: DownloadFilters, identifiers: DatabaseIdentifiers ): string {
  //
  // Build the SQL query to count the API general data
  
  const table = quoteIdentifierPath(identifiers.apiTable);
  const conditions = buildFilterConditions(
    'a',
    filters,
    identifiers.referenceColumn,
  );

  return `SELECT COUNT(*)::text AS count
FROM ${table} AS a
WHERE ${conditions.join('\n  AND ')}`;
}
