import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { bookAppointment, holdSlot, listSlots } from '../../modules/booking/index.ts';
import { listFacilities, listPractitioners } from '../../modules/directory/read.ts';
import { e164, idempotencyKey, isoDate, parse, uuid } from '../support.ts';

const PublicRange = z.object({
  facilityId: uuid,
  from: isoDate,
  to: isoDate,
}).refine((value) => value.to >= value.from && Date.parse(value.to) - Date.parse(value.from) <= 14 * 86_400_000, 'range must be 0–14 days');

/** Public booking surface for a dedicated single-tenant Exora runtime. */
export function registerTenantPublicBookingRoutes(app: FastifyInstance, db: Kysely<DB>, tenantId: string) {
  const caller = (correlationId: string): Caller => ({ tenantId, actor: { kind: 'system' }, correlationId });

  app.get('/public/v1/bootstrap', async (request) => {
    const tenant = await runQuery(db, tenantId, (tx) => tx.selectFrom('platform.tenant').select(['name', 'slug', 'plan_code as planCode']).where('id', '=', tenantId).executeTakeFirstOrThrow());
    const [facilities, practitioners] = await Promise.all([
      listFacilities(db, caller(request.id)),
      listPractitioners(db, caller(request.id), {}),
    ]);
    return { tenant, facilities, practitioners };
  });

  app.get('/public/v1/practitioners/:staffId/slots', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const range = parse(PublicRange, request.query);
    return { items: await listSlots(db, caller(request.id), { staffId, ...range }) };
  });

  app.post('/public/v1/holds', async (request, reply) => {
    const body = parse(z.object({
      facilityId: uuid,
      staffId: uuid,
      slotStart: z.iso.datetime({ offset: true }),
    }), request.body);
    return reply.status(201).send(await holdSlot(db, caller(request.id), body, idempotencyKey(request)));
  });

  app.post('/public/v1/appointments', async (request, reply) => {
    const body = parse(z.object({
      reservationId: uuid,
      name: z.string().trim().min(2).max(100),
      phone: e164,
      email: z.email().optional(),
      reason: z.string().trim().max(500).optional(),
    }), request.body);
    return reply.status(201).send(await bookAppointment(db, caller(request.id), {
      reservationId: body.reservationId,
      bookingParty: { name: body.name, phone: body.phone, email: body.email },
      originChannel: 'web',
      reason: body.reason,
    }, idempotencyKey(request)));
  });
}
