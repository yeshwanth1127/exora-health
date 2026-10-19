import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import type { VoiceRuntimeSettings } from '../../config.ts';
import type { Caller } from '../../caller.ts';
import {
  bookAppointment,
  cancelAppointment,
  holdSlot,
  listAppointments,
  listSessions,
  listSlots,
  releaseHold,
  rescheduleAppointment,
} from '../../modules/booking/index.ts';
import { listFacilities, listPractitioners } from '../../modules/directory/read.ts';
import { e164, idempotencyKey, isoDate, parse, uuid } from '../support.ts';

const VisitMode = z.enum(['in_person', 'virtual']);
const DateRange = z.object({
  start_date: isoDate,
  end_date: isoDate,
}).refine((v) => v.end_date >= v.start_date, 'end_date must be on or after start_date')
  .refine((v) => Date.parse(v.end_date) - Date.parse(v.start_date) <= 31 * 86_400_000, 'date range cannot exceed 31 days');
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digits = (value: string) => value.replace(/\D/g, '');
const hash = (value: string) => createHash('sha256').update(value).digest();
const sameSecret = (left: string, right: string) => timingSafeEqual(hash(left), hash(right));
const day = (date: Date) => date.toISOString().slice(0, 10);

type Integration = NonNullable<VoiceRuntimeSettings['integration']>;

function integrationCaller(request: FastifyRequest, tenantId: string, config: Integration): Caller {
  const key = request.headers['x-service-key'];
  if (typeof key !== 'string' || !sameSecret(key, config.serviceKey)) {
    throw new DomainError('forbidden', 'voice integration credentials were rejected');
  }
  return {
    tenantId,
    actor: { kind: 'staff', staffId: config.serviceAccountId },
    correlationId: request.id,
  };
}

function signHold(config: Integration, reservationId: string, expiresAt: Date) {
  const payload = `${reservationId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  const signature = createHmac('sha256', config.signingSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyHold(config: Integration, reservationId: string, token: string) {
  const [tokenReservation, rawExpiry, signature] = token.split('.');
  const expiry = Number(rawExpiry);
  if (tokenReservation !== reservationId || !Number.isInteger(expiry) || !signature || expiry * 1000 <= Date.now()) {
    throw new DomainError('forbidden', 'the voice booking hold has expired or is invalid');
  }
  const payload = `${tokenReservation}.${rawExpiry}`;
  const expected = createHmac('sha256', config.signingSecret).update(payload).digest('base64url');
  if (!sameSecret(signature, expected)) throw new DomainError('forbidden', 'the voice booking hold is invalid');
}

function appointmentWindow() {
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - 2);
  const to = new Date();
  to.setUTCFullYear(to.getUTCFullYear() + 2);
  return { from: day(from), to: day(to) };
}

async function ownedAppointment(
  db: Kysely<DB>,
  caller: Caller,
  input: { patientPhone: string; confirmationCode: string; appointmentId?: string },
) {
  const result = await listAppointments(db, caller, {
    ...appointmentWindow(),
    q: input.confirmationCode,
    limit: 25,
  });
  const phone = digits(input.patientPhone);
  const found = result.items.find((item) =>
    (!input.appointmentId || item.appointmentId === input.appointmentId)
    && item.confirmationCode.toUpperCase() === input.confirmationCode.toUpperCase()
    && digits(item.bookingPartyPhone ?? '').endsWith(phone),
  );
  if (!found) throw new DomainError('not_found', 'no appointment matched the phone number and confirmation code');
  return found;
}

/**
 * Server-to-server API used only by the Sarvam agent assigned to this single-tenant runtime.
 * The tenant is fixed by container configuration; no route accepts a caller-controlled tenant id.
 */
export function registerVoiceIntegrationRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  tenantId: string,
  config: Integration,
) {
  app.get('/api/v1/integrations/voice/branches', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const items = await listFacilities(db, caller);
    return {
      branches: items.map((item) => ({
        branch_id: item.facilityId,
        code: item.code,
        name: item.name,
        city: item.city,
        timezone: item.timezone,
        facility_type: item.facilityType,
      })),
      count: items.length,
    };
  });

  app.get('/api/v1/integrations/voice/doctors', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const query = parse(z.object({ department: z.string().trim().max(120).optional(), branch: z.string().trim().max(120).optional() }), request.query);
    const [practitioners, facilities] = await Promise.all([listPractitioners(db, caller, {}), listFacilities(db, caller)]);
    const facilityMap = new Map(facilities.map((facility) => [facility.facilityId, facility]));
    const department = query.department ? normalize(query.department) : '';
    const branch = query.branch ? normalize(query.branch) : '';
    const doctors = practitioners
      .filter((doctor) => !department || normalize(`${doctor.name} ${doctor.department} ${doctor.specialty ?? ''} ${doctor.specialtyName ?? ''}`).includes(department))
      .filter((doctor) => {
        const facility = facilityMap.get(doctor.facilityId);
        return !branch || normalize(`${facility?.name ?? ''} ${facility?.city ?? ''} ${facility?.code ?? ''}`).includes(branch);
      })
      .map((doctor) => {
        const facility = facilityMap.get(doctor.facilityId);
        return {
          doctor_id: doctor.staffId,
          name: doctor.name,
          specialty: doctor.specialtyName ?? doctor.specialty,
          department: doctor.department,
          branch_id: doctor.facilityId,
          branch_name: facility?.name,
          city: facility?.city,
          accepts_virtual: doctor.acceptsVirtual ?? false,
        };
      });
    return { doctors, count: doctors.length };
  });

  app.get('/api/v1/integrations/voice/availability', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const query = parse(DateRange.and(z.object({
      doctor_id: uuid,
      branch_id: uuid,
      consultation_type: VisitMode,
    })), request.query);
    const facilities = await listFacilities(db, caller);
    const facility = facilities.find((item) => item.facilityId === query.branch_id);
    if (!facility) throw new DomainError('not_found', 'branch not found');
    const slots = await listSlots(db, caller, {
      staffId: query.doctor_id,
      facilityId: query.branch_id,
      from: query.start_date,
      to: query.end_date,
    });
    return {
      timezone: facility.timezone,
      slots: slots.filter((slot) => slot.visitMode === query.consultation_type).map((slot) => ({
        doctor_id: query.doctor_id,
        branch_id: slot.facilityId,
        consultation_type: slot.visitMode,
        starts_at: slot.slotStart.toISOString(),
        ends_at: slot.slotEnd.toISOString(),
      })),
    };
  });

  app.get('/api/v1/integrations/voice/schedules', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const query = parse(DateRange.and(z.object({ doctor_id: uuid })), request.query);
    const sessions = await listSessions(db, caller, { staffId: query.doctor_id, from: query.start_date, to: query.end_date });
    return {
      schedules: sessions.map((session) => ({
        doctor_id: query.doctor_id,
        branch_id: session.facilityId,
        date: session.sessionOn,
        consultation_type: session.visitMode,
        starts_at: session.startsAt.toISOString(),
        ends_at: session.endsAt.toISOString(),
        slot_minutes: session.slotMinutes,
        source: session.source,
      })),
    };
  });

  app.post('/api/v1/integrations/voice/slot-holds', async (request, reply) => {
    const caller = integrationCaller(request, tenantId, config);
    const body = parse(z.object({
      doctor_id: uuid,
      branch_id: uuid,
      consultation_type: VisitMode,
      starts_at: z.iso.datetime({ offset: true }),
    }), request.body);
    const start = new Date(body.starts_at);
    // The caller supplies an absolute instant, while schedules are expanded using a
    // facility-local calendar date. Search the neighbouring UTC dates as well so a
    // valid slot near midnight is not rejected solely because of its timezone.
    const rangeStart = day(new Date(start.getTime() - 86_400_000));
    const rangeEnd = day(new Date(start.getTime() + 86_400_000));
    const candidate = (await listSlots(db, caller, {
      staffId: body.doctor_id,
      facilityId: body.branch_id,
      from: rangeStart,
      to: rangeEnd,
    })).find((slot) => slot.slotStart.getTime() === start.getTime() && slot.visitMode === body.consultation_type);
    if (!candidate) throw new DomainError('not_found', 'that appointment slot is not available');
    const hold = await holdSlot(db, caller, {
      staffId: body.doctor_id,
      facilityId: body.branch_id,
      slotStart: body.starts_at,
      holdMinutes: 7,
    }, idempotencyKey(request));
    return reply.status(201).send({
      id: hold.reservationId,
      status: 'active',
      starts_at: hold.slotStart.toISOString(),
      ends_at: hold.slotEnd.toISOString(),
      expires_at: hold.holdExpiresAt.toISOString(),
      hold_token: signHold(config, hold.reservationId, hold.holdExpiresAt),
    });
  });

  app.delete('/api/v1/integrations/voice/slot-holds/:holdId', async (request, reply) => {
    const caller = integrationCaller(request, tenantId, config);
    const { holdId } = parse(z.object({ holdId: uuid }), request.params);
    const { hold_token } = parse(z.object({ hold_token: z.string().min(32).max(500) }), request.query);
    verifyHold(config, holdId, hold_token);
    await releaseHold(db, caller, { reservationId: holdId });
    return reply.status(204).send();
  });

  app.post('/api/v1/integrations/voice/appointments', async (request, reply) => {
    const caller = integrationCaller(request, tenantId, config);
    const body = parse(z.object({
      hold_id: uuid,
      hold_token: z.string().min(32).max(500),
      patient_name: z.string().trim().min(2).max(160),
      patient_phone: e164,
      patient_email: z.email().optional(),
      reason: z.string().trim().max(500).optional(),
    }), request.body);
    verifyHold(config, body.hold_id, body.hold_token);
    const result = await bookAppointment(db, caller, {
      reservationId: body.hold_id,
      bookingParty: { name: body.patient_name, phone: body.patient_phone, email: body.patient_email },
      originChannel: 'voice',
      reason: body.reason,
    }, idempotencyKey(request));
    return reply.status(201).send({
      appointment_id: result.appointmentId,
      confirmation_code: result.confirmationCode,
      status: result.status,
      branch_id: result.facilityId,
      date: result.sessionOn,
      starts_at: result.startsAt,
      ends_at: result.endsAt,
    });
  });

  app.get('/api/v1/integrations/voice/appointments', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const query = parse(z.object({ patient_phone: e164, confirmation_code: z.string().trim().min(4).max(32) }), request.query);
    const appointment = await ownedAppointment(db, caller, { patientPhone: query.patient_phone, confirmationCode: query.confirmation_code });
    return {
      appointments: [{
        appointment_id: appointment.appointmentId,
        confirmation_code: appointment.confirmationCode,
        status: appointment.status,
        doctor_name: appointment.practitionerName,
        branch_id: appointment.facilityId,
        date: appointment.sessionOn,
        starts_at: appointment.startsAt?.toISOString() ?? null,
        ends_at: appointment.endsAt?.toISOString() ?? null,
        consultation_type: appointment.visitMode,
      }],
      count: 1,
    };
  });

  app.post('/api/v1/integrations/voice/appointments/:appointmentId/cancel', async (request) => {
    const caller = integrationCaller(request, tenantId, config);
    const { appointmentId } = parse(z.object({ appointmentId: uuid }), request.params);
    const body = parse(z.object({
      patient_phone: e164,
      confirmation_code: z.string().trim().min(4).max(32),
      reason: z.string().trim().min(3).max(500),
    }), request.body);
    await ownedAppointment(db, caller, { appointmentId, patientPhone: body.patient_phone, confirmationCode: body.confirmation_code });
    return cancelAppointment(db, caller, { appointmentId, reason: `Voice request: ${body.reason}` });
  });

  app.post('/api/v1/integrations/voice/appointments/:appointmentId/reschedule', async (request, reply) => {
    const caller = integrationCaller(request, tenantId, config);
    const { appointmentId } = parse(z.object({ appointmentId: uuid }), request.params);
    const body = parse(z.object({
      patient_phone: e164,
      confirmation_code: z.string().trim().min(4).max(32),
      hold_id: uuid,
      hold_token: z.string().min(32).max(500),
      reason: z.string().trim().max(500).optional(),
    }), request.body);
    await ownedAppointment(db, caller, { appointmentId, patientPhone: body.patient_phone, confirmationCode: body.confirmation_code });
    verifyHold(config, body.hold_id, body.hold_token);
    const result = await rescheduleAppointment(db, caller, {
      appointmentId,
      newReservationId: body.hold_id,
      reason: body.reason,
    }, idempotencyKey(request));
    return reply.status(201).send({
      appointment_id: result.appointmentId,
      confirmation_code: result.confirmationCode,
      status: result.status,
      date: result.sessionOn,
      starts_at: result.startsAt,
      ends_at: result.endsAt,
    });
  });
}
