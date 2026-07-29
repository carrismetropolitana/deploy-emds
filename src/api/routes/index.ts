import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/index.js';
import type { PublicDataRepository } from '../../database/repository/types.js';
import { registerAvailableRoutes } from './available.js';
import { registerDownloadRoutes } from './downloads.js';
import { registerSystemRoutes } from './system.js';

interface RegisterRoutesOptions {
  readonly config: AppConfig;
  readonly repository: PublicDataRepository;
}

export function registerRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions,
): void {
  registerSystemRoutes(app, options.repository);
  registerDownloadRoutes(app, options);
  registerAvailableRoutes(app, options);
}
