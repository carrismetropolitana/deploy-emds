/**
 * Error to indicate service unavailability.
 * 
 * Thrown when a requested operation cannot be performed due to upstream
 * or system-wide service outages (HTTP 503 Service Unavailable).
 *
 * Intended for error handling in API endpoints to signal caller that
 * the underlying service (e.g., database, external resource) is not
 * currently available and the failure is not due to a client error.
 *
 * Example usage:
 *   throw new ServiceUnavailableError('Database is temporarily unavailable');
 */
export class ServiceUnavailableError extends Error {
  /** Corresponds to HTTP 503 Service Unavailable. */
  readonly statusCode = 503;

  /**
   * Constructs a new ServiceUnavailableError.
   * @param message - Human-readable error message
   * @param options - Additional error options, e.g. cause
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ServiceUnavailableError';
  }
}
