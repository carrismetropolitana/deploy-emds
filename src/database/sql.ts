import type { DownloadFilters } from '../api/consts.js';

export interface DatabaseIdentifiers {
  readonly apiTable: string;
  readonly referenceColumn: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteIdentifierPath(identifierPath: string): string {
  return identifierPath.split('.').map(quoteIdentifier).join('.');
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function filtersSql(alias: string, filters: DownloadFilters, referenceColumn: string): string[] {
  const conditions = [
    `${alias}."yearmonth" = ${sqlLiteral(filters.yearmonth)}`,
    `${alias}."agency_id" = ${sqlLiteral(filters.agency_id)}`,
  ];

  if (filters.reference !== undefined) {
    conditions.push(
      `${alias}.${quoteIdentifier(referenceColumn)} = ${sqlLiteral(filters.reference)}`,
    );
  }

  if (filters.route_id !== undefined) {
    conditions.push(`${alias}."route_id" = ${sqlLiteral(filters.route_id)}`);
  }

  return conditions;
}

export function buildApiGeneralCopySql(filters: DownloadFilters, identifiers: DatabaseIdentifiers): string {
  const table = quoteIdentifierPath(identifiers.apiTable);
  const conditions = filtersSql(
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

export function buildAvailableSql(identifiers: DatabaseIdentifiers): string {
  const table = quoteIdentifierPath(identifiers.apiTable);
  const referenceColumn = quoteIdentifier(identifiers.referenceColumn);

  return `SELECT
  a."yearmonth"::text AS yearmonth,
  a."agency_id"::text AS agency_id,
  a.${referenceColumn}::text AS reference
FROM ${table} AS a
GROUP BY a."yearmonth", a."agency_id", a.${referenceColumn}
ORDER BY a."yearmonth" DESC, a."agency_id", a.${referenceColumn}`;
}
