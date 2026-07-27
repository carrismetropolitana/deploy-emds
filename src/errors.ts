export class ServiceUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ServiceUnavailableError';
  }
}
