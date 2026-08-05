import { ServiceUnavailableError } from "../errors.js";
import { type AvailableValuesResponse, type AvailableValuesService } from "../services/availability.js";

/* * */

export async function getAvailableValues(service: AvailableValuesService): Promise<AvailableValuesResponse> {
  try {
    return await service.list();
  } catch (error) {
    throw new ServiceUnavailableError(
      'The database is temporarily unavailable',
      { cause: error },
    );
  }
}