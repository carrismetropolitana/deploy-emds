import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { FakePublicDataRepository, testConfig } from './helpers.js';

const openApps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map(async (app) => app.close()));
});

async function createTestApp(repository = new FakePublicDataRepository()) {
  const app = await buildApp({
    config: testConfig,
    logger: false,
    repository,
  });
  openApps.push(app);
  return { app, repository };
}

describe('HTTP routes', () => {
  it('streams a filtered api_general CSV download', async () => {
    const { app, repository } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1?yearmonth=202605&agency_id=43&reference=freeflow&route_id=3112_0',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="api_general_202605_43_freeflow_route-3112_0.csv"',
    );
    expect(response.headers['access-control-expose-headers']).toBe(
      'Content-Disposition',
    );
    expect(response.body).toContain('202605,41');
    expect(repository.apiGeneralFilters).toEqual({
      agency_id: '43',
      reference: 'freeflow',
      route_id: '3112_0',
      yearmonth: '202605',
    });
  });

  it('allows reference to be omitted', async () => {
    const { app, repository } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1?yearmonth=202605&agency_id=43',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="api_general_202605_43.csv"',
    );
    expect(repository.apiGeneralFilters).toEqual({
      agency_id: '43',
      yearmonth: '202605',
    });
  });

  it('rejects missing, invalid, and unknown query parameters', async () => {
    const { app } = await createTestApp();

    const missing = await app.inject({
      method: 'GET',
      url: '/v1?yearmonth=202605',
    });
    const invalidMonth = await app.inject({
      method: 'GET',
      url: '/v1?yearmonth=202613&agency_id=41&reference=planned',
    });
    const unknown = await app.inject({
      method: 'GET',
      url: '/v1?yearmonth=202605&agency_id=41&reference=planned&limit=10',
    });

    expect(missing.statusCode).toBe(400);
    expect(invalidMonth.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('INVALID_QUERY');
  });

  it('returns grouped discovery data', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/availability',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      {
        agencies: [
          { agency_id: '41', references: ['freeflow', 'planned'] },
        ],
        yearmonth: '202605',
      },
    ]);
  });

  it('reports database readiness failures without exposing details', async () => {
    const repository = new FakePublicDataRepository();
    repository.pingError = new Error('password leaked here');
    const { app } = await createTestApp(repository);
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('password leaked here');
    expect(response.json()).toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The database is temporarily unavailable',
      },
    });
  });

  it('publishes the generated OpenAPI contract', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs' });
    const document = response.json();

    expect(response.statusCode).toBe(200);
    expect(document.openapi).toBe('3.0.3');
    expect(
      document.paths['/v1'].get.responses['200'],
    ).toBeDefined();
    expect(document.paths['/v1/availability'].get).toBeDefined();
  });
});
