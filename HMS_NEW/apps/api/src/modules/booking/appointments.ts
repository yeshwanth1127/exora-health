// The booking flow: hold a slot → book it → (reschedule | cancel | no-show) → check in → queue token.
// Walk-ins skip the hold and go straight to the queue. Double-booking is impossible regardless of
// this code: the reservation exclusion constraint rejects any overlapping hold or booking.
import { randomInt } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, writeAudit, writeOutbox, type AuditInput, type CommandContext, type EventInput } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { practitionerResourceId } from './calendar.ts';

type Priority = 'normal' | 'senior_citizen' | 'emergency' | 'vip';
type Channel = 'web' | 'portal' | 'whatsapp' | 'voice' | 'front_desk' | 'walk_in' | 'referral';
type VisitType = 'new' | 'follow_up' | 'review' | 'procedure';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const confirmationCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

// ---------------------------------------------------------------------------
// Hold
// ---------------------------------------------------------------------------

export interface HoldSlotInput {
  staffId: string;
  slotStart: Date | string;
  holdMinutes?: number;
}

export interface HoldResult {
  reservationId: string;
  slotStart: Date;
  slotEnd: Date;
  facilityId: string;
  holdExpiresAt: Date;
}

/** Puts a short hold on one free slot while the patient confirms. */
export async function holdSlot(db: Kysely<DB>, caller: Caller, input: HoldSlotInput, idempotencyKey?: string): Promise<HoldResult> {
  const holdMinutes = input.holdMinutes ?? 5;
  if (holdMinutes < 1 || holdMinutes > 30) throw invalid('holdMinutes must be between 1 and 30');
  const now = clock(caller);
  const result = await runCommand(
    db,
    { ...caller, module: 'booking', name: 'booking.hold_slot', idempotencyKey, request: input },
    async (ctx) => {
      const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
      const start = new Date(input.slotStart);
      const { rows: [slot] } = await sql<{ slot_start: Date; slot_end: Date; facility_id: string; status: string }>`
        SELECT slot_start, slot_end, facility_id, status
        FROM booking.available_slots(${resourceId}, (${start}::timestamptz)::date - 1, (${start}::timestamptz)::date + 1, ${now})
        WHERE slot_start = ${start}`.execute(ctx.tx);
      if (!slot) throw notFound('bookable slot', { staffId: input.staffId, slotStart: start.toISOString() });
      if (slot.status === 'blocked') throw conflict('slot is blocked', { reason: 'slot_blocked' });
      if (slot.status === 'taken') throw conflict('slot is no longer available', { reason: 'slot_unavailable' });

      // Lapsed holds still occupy the exclusion constraint until expired; clear any on this slot.
      await ctx.tx
        .updateTable('booking.reservation')
        .set({ status: 'expired' })
        .where('resource_id', '=', resourceId)
        .where('status', '=', 'held')
        .where('hold_expires_at', '<=', now)
        .where(sql<boolean>`period && tstzrange(${slot.slot_start}, ${slot.slot_end})`)
        .execute();

      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
      try {
        const { id } = await ctx.tx
          .insertInto('booking.reservation')
          .values({
            tenant_id: ctx.tenantId,
            resource_id: resourceId,
            facility_id: slot.facility_id,
            period: sql`tstzrange(${slot.slot_start}, ${slot.slot_end})`,
            status: 'held',
            hold_expires_at: holdExpiresAt,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return { reservationId: id, slotStart: slot.slot_start, slotEnd: slot.slot_end, facilityId: slot.facility_id, holdExpiresAt };
      } catch (err) {
        if (pgCode(err) === '23P01') throw conflict('slot is no longer available', { reason: 'slot_unavailable' });
        throw err;
      }
    },
  );
  // Results replayed from an idempotency record come back as JSON; restore the dates.
  return {
    ...result,
    slotStart: new Date(result.slotStart),
    slotEnd: new Date(result.slotEnd),
    holdExpiresAt: new Date(result.holdExpiresAt),
  };
}

export async function releaseHold(db: Kysely<DB>, caller: Caller, input: { reservationId: string }) {
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.release_hold', request: input }, async (ctx) => {
    const row = await ctx.tx
      .updateTable('booking.reservation')
      .set({ status: 'released' })
      .where('id', '=', input.reservationId)
      .where('status', '=', 'held')
      .returning('id')
      .executeTakeFirst();
    if (!row) throw notFound('active hold', input);
    return { reservationId: row.id };
  });
}

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

export interface BookingPartyInput {
  name: string;
  phone?: string;
  email?: string;
  verifiedChannel?: 'otp_sms' | 'whatsapp' | 'portal' | 'staff';
}

export interface BookAppointmentInput {
  reservationId: string;
  /** A registered patient… */
  patientId?: string;
  /** …and/or whoever is booking (may be unverified, e.g. a WhatsApp caller). */
  bookingParty?: BookingPartyInput;
  visitType?: VisitType;
  originChannel: Channel;
  priority?: Priority;
  reason?: string;
}

export interface AppointmentResult {
  appointmentId: string;
  confirmationCode: string;
  status: string;
  facilityId: string;
  sessionOn: string;
  startsAt: string | null;
  endsAt: string | null;
  feeMinor: number | null;
}

interface ResolvedFee {
  priceListItemId: string;
  unitPriceMinor: number;
}

/** Consultation fee from the active default price list: doctor-specific price first, then the generic one. */
async function consultationFee(tx: Transaction<DB>, healthcareServiceId: string | null, staffId: string, on: string, visitMode: string): Promise<ResolvedFee | null> {
  if (!healthcareServiceId) return null;
  const { rows: [fee] } = await sql<{ id: string; unit_price_minor: number }>`
    SELECT pli.id, pli.unit_price_minor
    FROM catalog.healthcare_service hs
    JOIN catalog.price_list_item pli ON pli.service_item_id = hs.consultation_service_item_id
    JOIN catalog.price_list pl ON pl.id = pli.price_list_id
    WHERE hs.id = ${healthcareServiceId}
      AND pl.status = 'active' AND pl.is_default
      AND pl.valid_from <= ${on}::date AND (pl.valid_to IS NULL OR pl.valid_to > ${on}::date)
      AND pli.valid_from <= ${on}::date AND (pli.valid_to IS NULL OR pli.valid_to > ${on}::date)
      AND pli.bed_category_id IS NULL
      AND (pli.staff_id IS NULL OR pli.staff_id = ${staffId})
      AND (pli.encounter_class IS NULL OR pli.encounter_class = ${visitMode === 'virtual' ? 'virtual' : 'outpatient'})
    ORDER BY (pli.staff_id IS NOT NULL) DESC, (pli.encounter_class IS NOT NULL) DESC
    LIMIT 1`.execute(tx);
  return fee ? { priceListItemId: fee.id, unitPriceMinor: fee.unit_price_minor } : null;
}

async function activePatient(tx: Transaction<DB>, patientId: string): Promise<void> {
  const p = await tx.selectFrom('patient.patient').select(['status', 'merged_into_patient_id']).where('id', '=', patientId).executeTakeFirst();
  if (!p) throw notFound('patient', { patientId });
  if (p.status === 'merged') throw preconditionFailed('patient record was merged; use the surviving record', { survivorPatientId: p.merged_into_patient_id });
  if (p.status !== 'active') throw preconditionFailed('patient record is inactive');
}

async function createBookingParty(ctx: CommandContext, party: BookingPartyInput, patientId: string | null, now: Date): Promise<string> {
  const { id } = await ctx.tx
    .insertInto('booking.booking_party')
    .values({
      tenant_id: ctx.tenantId,
      name: party.name,
      phone: party.phone ?? null,
      email: party.email ?? null,
      verified_channel: party.verifiedChannel ?? null,
      verified_at: party.verifiedChannel ? now : null,
      patient_id: patientId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

/**
 * Turns a held reservation into a confirmed appointment (shared by book and reschedule).
 * The hold must still be live; the session it falls in gives the date, service and visit mode.
 */
async function confirmHeldReservation(
  ctx: CommandContext,
  now: Date,
  reservationId: string,
  details: {
    patientId: string | null;
    bookingPartyId: string | null;
    visitType: VisitType;
    originChannel: Channel;
    priority: Priority;
    reason: string | null;
    rescheduledFromId: string | null;
  },
): Promise<AppointmentResult> {
  const reservation = await ctx.tx
    .selectFrom('booking.reservation as r')
    .innerJoin('booking.schedulable_resource as sr', 'sr.id', 'r.resource_id')
    .select(['r.id', 'r.resource_id', 'r.facility_id', 'r.status', 'r.hold_expires_at', 'sr.staff_id'])
    .select(sql<Date>`lower(r.period)`.as('starts_at'))
    .select(sql<Date>`upper(r.period)`.as('ends_at'))
    .where('r.id', '=', reservationId)
    .forUpdate('r')
    .executeTakeFirst();
  if (!reservation) throw notFound('reservation', { reservationId });
  if (reservation.status !== 'held' || !reservation.hold_expires_at || reservation.hold_expires_at <= now) {
    throw preconditionFailed('the hold on this slot has expired or was released; pick a slot again', { reason: 'hold_expired' });
  }
  if (!reservation.staff_id) throw invalid('reservation is not on a practitioner calendar');

  const { rows: [session] } = await sql<{ session_on: string; healthcare_service_id: string | null; visit_mode: string }>`
    SELECT session_on::text, healthcare_service_id, visit_mode
    FROM booking.sessions(${reservation.resource_id}, ${reservation.starts_at}::date - 1, ${reservation.starts_at}::date + 1)
    WHERE facility_id = ${reservation.facility_id}
      AND tstzrange(starts_at, ends_at) @> tstzrange(${reservation.starts_at}, ${reservation.ends_at})
    LIMIT 1`.execute(ctx.tx);
  if (!session) throw preconditionFailed('the slot is no longer part of the doctor\'s schedule', { reason: 'session_removed' });

  const fee = await consultationFee(ctx.tx, session.healthcare_service_id, reservation.staff_id, session.session_on, session.visit_mode);
  const code = confirmationCode();
  const appt = await ctx.tx
    .insertInto('booking.appointment')
    .values({
      tenant_id: ctx.tenantId,
      confirmation_code: code,
      reservation_id: reservation.id,
      booking_party_id: details.bookingPartyId,
      patient_id: details.patientId,
      practitioner_staff_id: reservation.staff_id,
      resource_id: reservation.resource_id,
      facility_id: reservation.facility_id,
      healthcare_service_id: session.healthcare_service_id,
      session_on: session.session_on,
      starts_at: reservation.starts_at,
      ends_at: reservation.ends_at,
      booking_kind: 'slot',
      visit_type: details.visitType,
      visit_mode: session.visit_mode,
      origin_channel: details.originChannel,
      priority: details.priority,
      fee_snapshot_minor: fee?.unitPriceMinor ?? null,
      price_list_item_id: fee?.priceListItemId ?? null,
      reason_text: details.reason,
      rescheduled_from_id: details.rescheduledFromId,
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
  await ctx.tx
    .updateTable('booking.reservation')
    .set({ status: 'booked', owner_type: 'appointment', owner_id: appt.id })
    .where('id', '=', reservation.id)
    .execute();

  const result: AppointmentResult = {
    appointmentId: appt.id,
    confirmationCode: code,
    status: 'confirmed',
    facilityId: reservation.facility_id,
    sessionOn: session.session_on,
    startsAt: reservation.starts_at.toISOString(),
    endsAt: reservation.ends_at.toISOString(),
    feeMinor: fee?.unitPriceMinor ?? null,
  };
  ctx.audit({ action: 'create', subjectType: 'booking.appointment', subjectId: appt.id, patientId: details.patientId });
  ctx.emit({
    eventType: 'appointment.confirmed',
    aggregateType: 'booking.appointment',
    aggregateId: appt.id,
    aggregateVersion: appt.version,
    payload: { ...result, practitionerStaffId: reservation.staff_id, patientId: details.patientId, bookingPartyId: details.bookingPartyId, visitMode: session.visit_mode },
  });
  return result;
}

export async function bookAppointment(db: Kysely<DB>, caller: Caller, input: BookAppointmentInput, idempotencyKey?: string): Promise<AppointmentResult> {
  if (!input.patientId && !input.bookingParty) throw invalid('give a patientId, a bookingParty, or both');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.book_appointment', idempotencyKey, request: input }, async (ctx) => {
    if (input.patientId) await activePatient(ctx.tx, input.patientId);
    const bookingPartyId = input.bookingParty ? await createBookingParty(ctx, input.bookingParty, input.patientId ?? null, now) : null;
    return confirmHeldReservation(ctx, now, input.reservationId, {
      patientId: input.patientId ?? null,
      bookingPartyId,
      visitType: input.visitType ?? 'new',
      originChannel: input.originChannel,
      priority: input.priority ?? 'normal',
      reason: input.reason ?? null,
      rescheduledFromId: null,
    });
  });
}

// ---------------------------------------------------------------------------
// Change: cancel, reschedule, no-show
// ---------------------------------------------------------------------------

async function lockAppointment(tx: Transaction<DB>, appointmentId: string) {
  const appt = await tx.selectFrom('booking.appointment').selectAll().where('id', '=', appointmentId).forUpdate().executeTakeFirst();
  if (!appt) throw notFound('appointment', { appointmentId });
  return appt;
}

async function cancelLocked(ctx: CommandContext, appt: { id: string; reservation_id: string | null; patient_id: string | null; status: string }, reason: string, now: Date) {
  if (appt.status !== 'confirmed' && appt.status !== 'checked_in') throw preconditionFailed(`a ${appt.status} appointment cannot be cancelled`);
  const updated = await ctx.tx
    .updateTable('booking.appointment')
    .set({ status: 'cancelled', cancelled_at: now, cancel_reason: reason })
    .where('id', '=', appt.id)
    .returning('version')
    .executeTakeFirstOrThrow();
  if (appt.reservation_id) {
    await ctx.tx.updateTable('booking.reservation').set({ status: 'released' }).where('id', '=', appt.reservation_id).execute();
  }
  await ctx.tx
    .updateTable('booking.queue_token')
    .set({ status: 'cancelled' })
    .where('appointment_id', '=', appt.id)
    .where('status', 'in', ['waiting', 'called'])
    .execute();
  ctx.audit({ action: 'status_change', subjectType: 'booking.appointment', subjectId: appt.id, patientId: appt.patient_id, reason });
  ctx.emit({
    eventType: 'appointment.cancelled',
    aggregateType: 'booking.appointment',
    aggregateId: appt.id,
    aggregateVersion: updated.version,
    payload: { appointmentId: appt.id, reason },
  });
}

export async function cancelAppointment(db: Kysely<DB>, caller: Caller, input: { appointmentId: string; reason: string }) {
  if (!input.reason.trim()) throw invalid('a cancellation reason is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.cancel_appointment', request: input }, async (ctx) => {
    const appt = await lockAppointment(ctx.tx, input.appointmentId);
    await cancelLocked(ctx, appt, input.reason, now);
    return { appointmentId: appt.id, status: 'cancelled' as const };
  });
}

/** Moves a confirmed appointment to a newly held slot: new appointment linked to the old, old cancelled. */
export async function rescheduleAppointment(
  db: Kysely<DB>,
  caller: Caller,
  input: { appointmentId: string; newReservationId: string; reason?: string },
  idempotencyKey?: string,
): Promise<AppointmentResult> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.reschedule_appointment', idempotencyKey, request: input }, async (ctx) => {
    const old = await lockAppointment(ctx.tx, input.appointmentId);
    if (old.status !== 'confirmed') throw preconditionFailed(`a ${old.status} appointment cannot be rescheduled`);
    if (old.booking_kind !== 'slot') throw preconditionFailed('walk-in visits cannot be rescheduled');
    // The new slot was held beforehand, so it can't overlap the old booking; cancel the old one first.
    await cancelLocked(ctx, old, `Rescheduled${input.reason ? `: ${input.reason}` : ''}`, now);
    const next = await confirmHeldReservation(ctx, now, input.newReservationId, {
      patientId: old.patient_id,
      bookingPartyId: old.booking_party_id,
      visitType: old.visit_type as VisitType,
      originChannel: old.origin_channel as Channel,
      priority: old.priority as Priority,
      reason: old.reason_text,
      rescheduledFromId: old.id,
    });
    ctx.emit({
      eventType: 'appointment.rescheduled',
      aggregateType: 'booking.appointment',
      aggregateId: next.appointmentId,
      payload: { fromAppointmentId: old.id, toAppointmentId: next.appointmentId },
    });
    return next;
  });
}

export async function markNoShow(db: Kysely<DB>, caller: Caller, input: { appointmentId: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.mark_no_show', request: input }, async (ctx) => {
    const appt = await lockAppointment(ctx.tx, input.appointmentId);
    if (appt.status !== 'confirmed') throw preconditionFailed(`a ${appt.status} appointment cannot be marked no-show`);
    if (appt.ends_at && appt.ends_at > now) throw preconditionFailed('the appointment has not ended yet');
    const updated = await ctx.tx
      .updateTable('booking.appointment')
      .set({ status: 'no_show' })
      .where('id', '=', appt.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'booking.appointment', subjectId: appt.id, patientId: appt.patient_id });
    ctx.emit({ eventType: 'appointment.no_show', aggregateType: 'booking.appointment', aggregateId: appt.id, aggregateVersion: updated.version, payload: { appointmentId: appt.id } });
    return { appointmentId: appt.id, status: 'no_show' as const };
  });
}

// ---------------------------------------------------------------------------
// Arrive: check-in and walk-in
// ---------------------------------------------------------------------------

/** Today's date at a facility (its local calendar day). */
async function facilityToday(tx: Transaction<DB>, facilityId: string, now: Date): Promise<string> {
  const { rows: [r] } = await sql<{ today: string }>`
    SELECT ((${now}::timestamptz) AT TIME ZONE f.timezone)::date::text AS today FROM platform.facility f WHERE f.id = ${facilityId}`.execute(tx);
  if (!r) throw notFound('facility', { facilityId });
  return r.today;
}

export interface CheckInResult {
  appointmentId: string;
  tokenId: string;
  tokenNo: number;
}

async function issueToken(
  ctx: CommandContext,
  appt: { id: string; facility_id: string; resource_id: string; session_on: string; priority: string },
  patientId: string,
): Promise<{ tokenId: string; tokenNo: number }> {
  const { rows: [n] } = await sql<{ n: number }>`
    SELECT platform.next_number('token', ${appt.facility_id}, ${`${appt.resource_id}:${appt.session_on}`}) AS n`.execute(ctx.tx);
  const { id } = await ctx.tx
    .insertInto('booking.queue_token')
    .values({
      tenant_id: ctx.tenantId,
      facility_id: appt.facility_id,
      resource_id: appt.resource_id,
      session_on: appt.session_on,
      token_no: n!.n,
      appointment_id: appt.id,
      patient_id: patientId,
      priority: appt.priority,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { tokenId: id, tokenNo: n!.n };
}

async function checkInLocked(
  ctx: CommandContext,
  now: Date,
  appt: Awaited<ReturnType<typeof lockAppointment>>,
  patientId: string | undefined,
): Promise<CheckInResult> {
  if (appt.status !== 'confirmed') throw preconditionFailed(`a ${appt.status} appointment cannot be checked in`);
  if (appt.session_on !== (await facilityToday(ctx.tx, appt.facility_id, now))) {
    throw preconditionFailed('check-in is only possible on the day of the appointment', { sessionOn: appt.session_on });
  }
  if (appt.patient_id && patientId && appt.patient_id !== patientId) throw conflict('appointment is already linked to a different patient');
  const resolvedPatientId = appt.patient_id ?? patientId;
  if (!resolvedPatientId) throw preconditionFailed('register or identify the patient before check-in', { reason: 'patient_required' });
  await activePatient(ctx.tx, resolvedPatientId);

  const updated = await ctx.tx
    .updateTable('booking.appointment')
    .set({ status: 'checked_in', checked_in_at: now, patient_id: resolvedPatientId })
    .where('id', '=', appt.id)
    .returning('version')
    .executeTakeFirstOrThrow();
  if (appt.booking_party_id) {
    // The booker is now identified: link the booking party to the patient.
    await ctx.tx
      .updateTable('booking.booking_party')
      .set({ patient_id: resolvedPatientId })
      .where('id', '=', appt.booking_party_id)
      .where('patient_id', 'is', null)
      .execute();
  }
  const token = await issueToken(ctx, appt, resolvedPatientId);
  ctx.audit({ action: 'status_change', subjectType: 'booking.appointment', subjectId: appt.id, patientId: resolvedPatientId });
  ctx.emit({
    eventType: 'appointment.checked_in',
    aggregateType: 'booking.appointment',
    aggregateId: appt.id,
    aggregateVersion: updated.version,
    payload: { appointmentId: appt.id, patientId: resolvedPatientId, facilityId: appt.facility_id, tokenNo: token.tokenNo, practitionerStaffId: appt.practitioner_staff_id },
  });
  return { appointmentId: appt.id, ...token };
}

/** Patient arrives for a booked appointment: links the patient if needed and issues a queue token. */
export async function checkIn(db: Kysely<DB>, caller: Caller, input: { appointmentId: string; patientId?: string }, idempotencyKey?: string): Promise<CheckInResult> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.check_in', idempotencyKey, request: input }, async (ctx) => {
    const appt = await lockAppointment(ctx.tx, input.appointmentId);
    return checkInLocked(ctx, now, appt, input.patientId);
  });
}

/**
 * Event consumer step: a virtual patient entered the waiting room, so they have "arrived". Checks the
 * appointment in when the patient record is already linked and it is the appointment's day; otherwise
 * leaves it for the front desk (who link the patient at check-in). Idempotent.
 */
export async function checkInVirtualArrival(tx: Transaction<DB>, tenantId: string, appointmentId: string, at: Date, correlationId: string | null): Promise<boolean> {
  const appt = await lockAppointment(tx, appointmentId);
  if (appt.status !== 'confirmed' || appt.visit_mode !== 'virtual' || !appt.patient_id) return false;
  if (appt.session_on !== (await facilityToday(tx, appt.facility_id, at))) return false;
  const audits: AuditInput[] = [];
  const events: EventInput[] = [];
  const ctx: CommandContext = {
    tx,
    tenantId,
    actor: { kind: 'system' },
    correlationId: correlationId ?? '',
    audit: (a) => audits.push(a),
    emit: (e) => events.push(e),
  };
  await checkInLocked(ctx, at, appt, undefined);
  await writeAudit(tx, tenantId, null, correlationId, audits.map((a) => ({ ...a, reason: 'patient entered the virtual waiting room' })));
  await writeOutbox(tx, tenantId, correlationId, events);
  return true;
}

export interface WalkInInput {
  staffId: string;
  facilityId: string;
  patientId: string;
  priority?: Priority;
  visitType?: VisitType;
  reason?: string;
}

/**
 * A patient without a booking joins today's queue. The doctor must have a session at the facility
 * today that hasn't ended and that takes walk-ins, with tokens left.
 */
export async function bookWalkIn(db: Kysely<DB>, caller: Caller, input: WalkInInput, idempotencyKey?: string): Promise<AppointmentResult & CheckInResult> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.book_walk_in', idempotencyKey, request: input }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    await activePatient(ctx.tx, input.patientId);
    const today = await facilityToday(ctx.tx, input.facilityId, now);
    // Serialise walk-ins per doctor so the capacity check can't be raced.
    await ctx.tx.selectFrom('booking.schedulable_resource').select('id').where('id', '=', resourceId).forUpdate().execute();

    const { rows: sessions } = await sql<{ healthcare_service_id: string | null; visit_mode: string; max_walk_in_tokens: number; ends_at: Date }>`
      SELECT healthcare_service_id, visit_mode, max_walk_in_tokens, ends_at
      FROM booking.sessions(${resourceId}, ${today}::date, ${today}::date)
      WHERE facility_id = ${input.facilityId}
      ORDER BY starts_at`.execute(ctx.tx);
    const open = sessions.filter((s) => s.ends_at > now);
    if (!open.length) throw preconditionFailed('the doctor has no remaining session at this facility today', { reason: 'no_session' });
    const capacity = sessions.reduce((sum, s) => sum + s.max_walk_in_tokens, 0);
    if (capacity === 0) throw preconditionFailed('the doctor is not taking walk-ins today', { reason: 'no_walk_ins' });
    const { used } = await ctx.tx
      .selectFrom('booking.appointment')
      .select((eb) => eb.fn.countAll<number>().as('used'))
      .where('resource_id', '=', resourceId)
      .where('facility_id', '=', input.facilityId)
      .where('session_on', '=', today)
      .where('booking_kind', '=', 'walk_in')
      .where('status', '<>', 'cancelled')
      .executeTakeFirstOrThrow();
    if (Number(used) >= capacity) throw conflict('walk-in tokens for today are full', { reason: 'walk_ins_full', capacity });

    const session = open[0]!;
    const fee = await consultationFee(ctx.tx, session.healthcare_service_id, input.staffId, today, session.visit_mode);
    const code = confirmationCode();
    const appt = await ctx.tx
      .insertInto('booking.appointment')
      .values({
        tenant_id: ctx.tenantId,
        confirmation_code: code,
        patient_id: input.patientId,
        practitioner_staff_id: input.staffId,
        resource_id: resourceId,
        facility_id: input.facilityId,
        healthcare_service_id: session.healthcare_service_id,
        session_on: today,
        booking_kind: 'walk_in',
        visit_type: input.visitType ?? 'new',
        visit_mode: 'in_person',
        origin_channel: 'walk_in',
        priority: input.priority ?? 'normal',
        fee_snapshot_minor: fee?.unitPriceMinor ?? null,
        price_list_item_id: fee?.priceListItemId ?? null,
        reason_text: input.reason ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'booking.appointment', subjectId: appt.id, patientId: input.patientId });
    ctx.emit({
      eventType: 'appointment.confirmed',
      aggregateType: 'booking.appointment',
      aggregateId: appt.id,
      payload: { appointmentId: appt.id, bookingKind: 'walk_in', patientId: input.patientId, practitionerStaffId: input.staffId },
    });
    const locked = await lockAppointment(ctx.tx, appt.id);
    const checkedIn = await checkInLocked(ctx, now, locked, input.patientId);
    return {
      appointmentId: appt.id,
      confirmationCode: code,
      status: 'checked_in',
      facilityId: input.facilityId,
      sessionOn: today,
      startsAt: null,
      endsAt: null,
      feeMinor: fee?.unitPriceMinor ?? null,
      tokenId: checkedIn.tokenId,
      tokenNo: checkedIn.tokenNo,
    };
  });
}
