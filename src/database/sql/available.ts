import type { AgencyId } from '../../domain/consts.js';
import { quoteIdentifier, quoteIdentifierPath, sqlLiteral } from './helpers.js';
import type { DatabaseIdentifiers } from './types.js';

export function buildAvailableSql( identifiers: DatabaseIdentifiers ): string {
  //
  // Build the SQL query to list available data
  
  const table = quoteIdentifierPath(identifiers.apiTable);
  const referenceColumn = quoteIdentifier(identifiers.referenceColumn);

  return `SELECT
  a."yearmonth"::text AS yearmonth,
  a."agency_id"::text AS agency_id,
  a.${referenceColumn}::text AS reference,
  a."disturbance_class"::text AS disturbance_class
FROM ${table} AS a
GROUP BY a."yearmonth", a."agency_id", a.${referenceColumn}, a."disturbance_class"
ORDER BY a."yearmonth" DESC, a."agency_id", a.${referenceColumn}, a."disturbance_class"`;
}

function buildAvailableValuesSql( identifiers: DatabaseIdentifiers, column: 'route_id' | 'trip_id', agencyId?: AgencyId ): string {
  const table = quoteIdentifierPath(identifiers.apiTable);
  const quotedColumn = quoteIdentifier(column);
  const agencyCondition =
    agencyId === undefined
      ? ''
      : `\n  AND a."agency_id" = ${sqlLiteral(agencyId)}`;

  return `SELECT DISTINCT
  a.${quotedColumn}::text AS value
FROM ${table} AS a
WHERE a.${quotedColumn} IS NOT NULL${agencyCondition}
ORDER BY value`;
}

export function buildAvailableRoutesSql( identifiers: DatabaseIdentifiers, agencyId?: AgencyId ): string {
  //
  // Build the SQL query to list available routes
  
  return buildAvailableValuesSql(identifiers, 'route_id', agencyId);
}

export function buildAvailableTripsSql( identifiers: DatabaseIdentifiers, agencyId?: AgencyId ): string {
  //
  // Build the SQL query to list available trips
  
  return buildAvailableValuesSql(identifiers, 'trip_id', agencyId);
}
