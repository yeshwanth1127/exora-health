import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import { listFacilities, listPractitioners } from '../../modules/directory/read.ts';
import { callerOf, parse, principalOf, uuid } from '../support.ts';

export function registerDirectoryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/facilities', async (request) => {
    authorize(principalOf(request), 'catalog.read');
    return { items: await listFacilities(db, callerOf(request)) };
  });

  app.get('/v1/practitioners', async (request) => {
    const q = parse(z.object({ facilityId: uuid.optional(), specialty: z.string().max(64).optional() }), request.query);
    authorize(principalOf(request), 'catalog.read', q.facilityId);
    return { items: await listPractitioners(db, callerOf(request), q) };
  });
}
