import {isHospitalTemplate} from '@hms/website-templates';
import { tenantWebsiteProfile, websiteContent } from '../../modules/booking/website-profile.ts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import { attributeBooking, hostedAnalyticsSite } from '../../modules/comms/managed-analytics.ts';
import type { ManagedSettings } from '../../modules/comms/managed-config.ts';
import type { Caller } from '../../caller.ts';
import { bookAppointment, holdSlot, listSlots } from '../../modules/booking/index.ts';
import { listFacilities, listPractitioners } from '../../modules/directory/read.ts';
import { e164, idempotencyKey, isoDate, parse, uuid } from '../support.ts';

const PublicRange = z.object({
  facilityId: uuid,
  from: isoDate,
  to: isoDate,
}).refine((value) => value.to >= value.from && Date.parse(value.to) - Date.parse(value.from) <= 14 * 86_400_000, 'range must be 0–14 days');

/** Public booking surface for a dedicated single-tenant Paperwhale runtime. */
export function registerTenantPublicBookingRoutes(app: FastifyInstance, db: Kysely<DB>, tenantId: string, managed: ManagedSettings) {
  const content = websiteContent(process.env.WEBSITE_CONTENT_JSON);
  app.get('/public/v1/website', async (_request, reply) => {
    reply.header('cache-control','no-store');
    const template=process.env.WEBSITE_TEMPLATE||'standard';
    const binding=managed.booking?.sites.find(s=>s.tenantId===tenantId&&(!process.env.BOOTSTRAP_FACILITY_ID||s.facilityId===process.env.BOOTSTRAP_FACILITY_ID));
    return tenantWebsiteProfile(db, tenantId, content, process.env.BOOTSTRAP_FACILITY_ID||(isHospitalTemplate(template)?binding?.facilityId:undefined), {template,bookingSite:binding?.siteSlug??null});
  });

  const caller = (correlationId: string): Caller => ({ tenantId, actor: { kind: 'system' }, correlationId });

  app.get('/public/v1/bootstrap', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const tenant = await runQuery(db, tenantId, (tx) => tx.selectFrom('platform.tenant').select(['name', 'slug', 'plan_code as planCode']).where('id', '=', tenantId).executeTakeFirstOrThrow());
    const [facilities, practitioners] = await Promise.all([
      listFacilities(db, caller(request.id)),
      listPractitioners(db, caller(request.id), {}),
    ]);
    const analytics = facilities[0] ? await hostedAnalyticsSite(db, tenantId, facilities[0].facilityId, managed).catch(() => null) : null;
    return { tenant, facilities, practitioners, analytics };
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
    const result = await bookAppointment(db, caller(request.id), {
      reservationId: body.reservationId,
      bookingParty: { name: body.name, phone: body.phone, email: body.email },
      originChannel: 'web',
      reason: body.reason,
    }, idempotencyKey(request));
    const origin = request.headers.origin;
    if (origin && origin === managed.publicOrigin && request.headers['sec-gpc'] !== '1' && request.headers.dnt !== '1') {
      // The committed appointment determines the clinic; the public caller cannot choose it.
      const facility = await runQuery(db, tenantId, tx => tx.selectFrom('booking.appointment').select('facility_id').where('id', '=', result.appointmentId).executeTakeFirst());
      if (facility) await attributeBooking(db, tenantId, facility.facility_id, origin, result.appointmentId, managed)
        .catch(() => request.log.warn('Website booking attribution is unavailable'));
    }
    return reply.status(201).send(result);
  });
}
