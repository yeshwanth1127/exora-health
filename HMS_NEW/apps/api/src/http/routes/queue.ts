import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import { callNext, completeService, listQueue, skipToken, startService, tokenFacility } from '../../modules/booking/index.ts';
import { callerOf, isoDate, parse, principalOf, uuid } from '../support.ts';

const QueueKey = z.object({ staffId: uuid, facilityId: uuid, date: isoDate });

export function registerQueueRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/queue', async (request) => {
    const q = parse(QueueKey, request.query);
    authorize(principalOf(request), 'appointments.read', q.facilityId);
    return { items: await listQueue(db, callerOf(request), { staffId: q.staffId, facilityId: q.facilityId, sessionOn: q.date }) };
  });

  app.post('/v1/queue/call-next', async (request, reply) => {
    const q = parse(QueueKey, request.body);
    authorize(principalOf(request), 'queue.manage', q.facilityId);
    const next = await callNext(db, callerOf(request), { staffId: q.staffId, facilityId: q.facilityId, sessionOn: q.date });
    return next ?? reply.status(204).send();
  });

  for (const [action, fn] of [['start', startService], ['complete', completeService], ['skip', skipToken]] as const) {
    app.post(`/v1/queue-tokens/:tokenId/${action}`, async (request) => {
      const { tokenId } = parse(z.object({ tokenId: uuid }), request.params);
      const facilityId = await tokenFacility(db, callerOf(request), tokenId);
      if (!facilityId) throw new DomainError('not_found', 'queue token not found');
      authorize(principalOf(request), 'queue.manage', facilityId);
      return fn(db, callerOf(request), { tokenId });
    });
  }
}
