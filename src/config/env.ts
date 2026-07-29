const SQL_IDENTIFIER_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/;
const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function getBoolean(environment: NodeJS.ProcessEnv,name: string,fallback: boolean): boolean {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false"`);
}

export function getIdentifier(environment: NodeJS.ProcessEnv,name: string,fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier`);
  }

  return value;
}

export function getIdentifierPath(environment: NodeJS.ProcessEnv,name: string,fallback: string): string {
  const value = environment[name]?.trim() || fallback;
  if (!SQL_IDENTIFIER_PATH_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid PostgreSQL identifier path`);
  }

  return value;
}

export function getInteger(environment: NodeJS.ProcessEnv,name: string,fallback: number,minimum: number): number {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}`,
    );
  }

  return value;
}
