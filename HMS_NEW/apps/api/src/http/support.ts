// Shared HTTP plumbing: input parsing, idempotency keys, the caller of a request, error mapping.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DomainError, type DomainErrorCode } from '@hms/platform';
import type { Caller } from '../caller.ts';
import type { Principal } from '../auth/principal.ts';
import { AuthenticationError } from '../auth/verify.ts';

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | null;
    clockOverride: Date | undefined;
  }
}

export const uuid = z.uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
export const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'expected E.164 phone, e.g. +919876543210');

/** Parses input with a Zod schema; failures become a 400 with the issues listed. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new DomainError('validation', 'request validation failed', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** Commands that create things require an Idempotency-Key header so client retries are safe. */
export function idempotencyKey(request: FastifyRequest): string {
  const key = request.headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) {
    throw new DomainError('validation', 'Idempotency-Key header is required (8–128 characters: letters, digits, _ . : -)');
  }
  return key;
}

export function principalOf(request: FastifyRequest): Principal {
  if (!request.principal) throw new AuthenticationError('not authenticated');
  return request.principal;
}

export function callerOf(request: FastifyRequest): Caller {
  const p = principalOf(request);
  return {
    tenantId: p.tenantId,
    actor: { kind: 'staff', staffId: p.staffId, userId: p.userAccountId },
    now: request.clockOverride,
    correlationId: request.id,
  };
}

const STATUS: Record<DomainErrorCode, number> = {
  validation: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  idempotency_conflict: 409,
  precondition_failed: 422,
};

export function sendError(request: FastifyRequest, reply: FastifyReply, err: unknown) {
  if (err instanceof DomainError) {
    return reply.status(STATUS[err.code]).send({ error: { code: err.code, message: err.message, details: err.details ?? null }, requestId: request.id });
  }
  if (err instanceof AuthenticationError) {
    return reply.status(401).header('www-authenticate', 'Bearer').send({ error: { code: 'unauthenticated', message: err.message }, requestId: request.id });
  }
  const fastifyErr = err as { statusCode?: number; message?: string; code?: string };
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    return reply.status(fastifyErr.statusCode).send({ error: { code: 'bad_request', message: fastifyErr.message ?? 'bad request' }, requestId: request.id });
  }
  request.log.error({ err }, 'unhandled error');
  return reply.status(500).send({ error: { code: 'internal', message: 'internal server error' }, requestId: request.id });
}
