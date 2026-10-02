import type { ValidationError } from 'class-validator';

// Messages start with the full path (items.0.rate ...) so the client can map them to fields.
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) =>
      constraint === 'whitelistValidation'
        ? `property ${path} should not exist`
        : withPath(message, error.property, path),
    );
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

function withPath(message: string, property: string, path: string): string {
  if (message.startsWith(`${property} `)) return `${path}${message.slice(property.length)}`;
  return `${path}: ${message}`;
}
