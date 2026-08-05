import type { AgencyServices } from '../../types/interfaces/available.js';
import type { AgencyId } from '../../types/types.js';
import { AvailableValuesService } from '../services/availability.js';

/* * */

export function getAgencyService( services: AgencyServices, agencyId: AgencyId ): AvailableValuesService {
  const service = services.get(agencyId);
  if (!service) {
    throw new Error(
      `Available values service is missing for agency ${agencyId}`,
    );
  }

  return service;
}
