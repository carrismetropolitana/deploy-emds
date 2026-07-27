import { describe, expect, it } from 'vitest';

import { AvailabilityService, groupAvailability } from '../src/availability.js';
import { FakePublicDataRepository } from './helpers.js';

describe('availability', () => {
  it('groups references under month and agency', () => {
    expect(
      groupAvailability([
        { agency_id: '41', reference: 'planned', yearmonth: '202605' },
        { agency_id: '41', reference: 'freeflow', yearmonth: '202605' },
        { agency_id: '42', reference: 'freeflow', yearmonth: '202605' },
      ]),
    ).toEqual([
      {
        yearmonth: '202605',
        agencies: [
          { agency_id: '41', references: ['freeflow', 'planned'] },
          { agency_id: '42', references: ['freeflow'] },
        ],
      },
    ]);
  });

  it('caches discovery data', async () => {
    const repository = new FakePublicDataRepository();
    let calls = 0;
    repository.listAvailability = async () => {
      calls += 1;
      return repository.availability;
    };
    const service = new AvailabilityService(repository, 60_000);

    const first = await service.list();
    const second = await service.list();

    expect(second).toBe(first);
    expect(calls).toBe(1);
  });
});
