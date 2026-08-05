import { AGENCY_IDS } from '../../types/consts.js';
import type { AgencyServices } from '../../types/interfaces/available.js';
import type { AgencyId } from '../../types/types.js';
import { AvailableValuesService } from '../services/availability.js';

/* * */

export function createAgencyServices( loadValues: (agencyId: AgencyId) => Promise<readonly string[]>, cacheTtlMilliseconds: number ): AgencyServices {
  return new Map(
    AGENCY_IDS.map((agencyId) => [
      agencyId,
      new AvailableValuesService(
        () => loadValues(agencyId),
        cacheTtlMilliseconds,
      ),
    ]),
  );
}
