import { describe, expect, it } from 'vitest';

import type { DownloadFilters } from '../src/domain.js';
import {
  buildAvailabilitySql,
  buildApiGeneralCopySql,
  sqlLiteral,
} from '../src/sql.js';

const identifiers = {
  apiTable: 'mobilidade.api_general',
  referenceColumn: 'reference_type',
};
const filters: DownloadFilters = {
  agency_id: '43',
  reference: 'freeflow',
  route_id: '3112_0',
  yearmonth: '202605',
};

describe('download SQL', () => {
  it('builds a COPY query with every api_general filter', () => {
    const sql = buildApiGeneralCopySql(filters, identifiers);

    expect(sql).toContain('FROM "mobilidade"."api_general" AS a');
    expect(sql).toContain('a."yearmonth" = \'202605\'');
    expect(sql).toContain('a."agency_id" = \'43\'');
    expect(sql).toContain('a."reference_type" = \'freeflow\'');
    expect(sql).toContain('a."route_id" = \'3112_0\'');
    expect(sql).toContain(
      "TO STDOUT WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8')",
    );
  });

  it('omits route_id when the optional filter is absent', () => {
    const { route_id: _routeId, ...requiredFilters } = filters;
    const sql = buildApiGeneralCopySql(requiredFilters, identifiers);

    expect(sql).not.toContain('a."route_id"');
  });

  it('omits reference when the optional filter is absent', () => {
    const { reference: _reference, ...filtersWithoutReference } = filters;
    const sql = buildApiGeneralCopySql(filtersWithoutReference, identifiers);

    expect(sql).not.toContain('a."reference_type" =');
  });

  it('escapes SQL string literals defensively', () => {
    expect(sqlLiteral("route' OR true --")).toBe("'route'' OR true --'");
  });

  it('builds the discovery aggregation from api_general', () => {
    const sql = buildAvailabilitySql(identifiers);

    expect(sql).toContain('a."yearmonth"::text AS yearmonth');
    expect(sql).toContain('a."reference_type"::text AS reference');
    expect(sql).toContain('GROUP BY');
  });
});
