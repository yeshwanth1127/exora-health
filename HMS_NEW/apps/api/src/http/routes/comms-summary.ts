import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import { callerOf, parse, principalOf, uuid } from '../support.ts';
import { notificationSummary } from '../../modules/comms/summary.ts';

export function registerCommsSummaryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/comms/summary', async (request) => {
    const { facilityId } = parse(z.strictObject({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'comms.read', facilityId);
    return notificationSummary(db, callerOf(request), facilityId);
  });
}
