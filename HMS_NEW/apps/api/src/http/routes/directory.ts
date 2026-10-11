import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import { quoteFees } from '../../modules/booking/index.ts';
import { facilityDirectory, listFacilities, listPractitioners } from '../../modules/directory/read.ts';
import { callerOf, isoDate, parse, principalOf, uuid } from '../support.ts';

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

  app.get('/v1/facilities/:facilityId/directory', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    authorize(principalOf(request), 'catalog.read', facilityId);
    return facilityDirectory(db, callerOf(request), facilityId);
  });

  app.get('/v1/practitioners/:staffId/fees', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const q = parse(z.object({ facilityId: uuid, on: isoDate }), request.query);
    authorize(principalOf(request), 'catalog.read', q.facilityId);
    return { items: await quoteFees(db, callerOf(request), { staffId, ...q }) };
  });
}
