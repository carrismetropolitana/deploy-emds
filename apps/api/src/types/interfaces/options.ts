import type { AppConfig } from "../../config/types.js";
import type { PublicDataRepository } from './repository.js';

/* * */

export interface BuildAppOptions {
    readonly config: AppConfig;
    readonly logger?: false;
    readonly repository: PublicDataRepository;
  }
