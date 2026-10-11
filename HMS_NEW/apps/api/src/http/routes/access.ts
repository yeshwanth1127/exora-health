// Workspace administration (G16) and the activity log (G18).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorizeEvery } from '../../auth/principal.ts';
import { exportAuditEvents, listAuditEvents } from '../../modules/access/index.ts';
import { callerOf, isoDate, parse, principalOf } from '../support.ts';

const AuditFilter = z
  .object({
    actor: z.string().trim().max(100).optional(),
    record: z.string().trim().max(64).optional(),
    action: z.string().trim().max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, { message: 'from must be on or before to', path: ['to'] });

export function registerAccessRoutes(app: FastifyInstance, db: Kysely<DB>) {
  // The log spans every clinic and module and names patients by id: audit.read at every clinic.
  app.get('/v1/audit-events', async (request) => {
    const q = parse(AuditFilter.and(z.object({ limit: z.coerce.number().int().min(1).max(500).optional() })), request.query ?? {});
    authorizeEvery(principalOf(request), 'audit.read', []);
    const { limit, ...filter } = q;
    return listAuditEvents(db, callerOf(request), filter, limit ?? 50);
  });

  app.post('/v1/audit-events/export', async (request) => {
    const filter = parse(AuditFilter, request.body ?? {});
    authorizeEvery(principalOf(request), 'audit.read', []);
    return exportAuditEvents(db, callerOf(request), filter);
  });
}
