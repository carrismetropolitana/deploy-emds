import type { PublicDataRepository } from './repository.js';

/* * */

export interface RegisterRoutesOptions {
  readonly repository: PublicDataRepository;
}

export interface AvailableRoutesOptions {
  readonly repository: PublicDataRepository;
}

export interface DownloadRoutesOptions {
  readonly repository: PublicDataRepository;
}
