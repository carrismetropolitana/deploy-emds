import type { FastifyInstance } from 'fastify';

import { registerAvailableRoutes } from './available.js';
import { registerDownloadRoutes } from './downloads.js';
import { registerSystemRoutes } from './system.js';
import { type RegisterRoutesOptions } from '../../types/interfaces/routes.js';

/* * */

export function registerRoutes( app: FastifyInstance, options: RegisterRoutesOptions ): void {
  registerSystemRoutes(app, options.repository);
  registerDownloadRoutes(app, options);
  registerAvailableRoutes(app, options);
}
