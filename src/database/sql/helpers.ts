export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteIdentifierPath(identifierPath: string): string {
  return identifierPath.split('.').map(quoteIdentifier).join('.');
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
