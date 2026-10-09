// Domain errors. The API layer (Phase 4) maps `code` to an HTTP status.

export type DomainErrorCode =
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'forbidden'
  | 'idempotency_conflict'
  | 'precondition_failed';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string, details?: Record<string, unknown>) => new DomainError('not_found', `${what} not found`, details);
export const conflict = (message: string, details?: Record<string, unknown>) => new DomainError('conflict', message, details);
export const invalid = (message: string, details?: Record<string, unknown>) => new DomainError('validation', message, details);
export const preconditionFailed = (message: string, details?: Record<string, unknown>) =>
  new DomainError('precondition_failed', message, details);

/** SQLSTATE of a node-postgres error, if any. */
export function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : undefined;
}
