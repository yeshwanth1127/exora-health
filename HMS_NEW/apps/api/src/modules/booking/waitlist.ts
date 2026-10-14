// Staff waitlist (G11): requests per clinic and doctor. An offer holds one real slot for 15 minutes while
// reception phones the caller, who accepts (the hold becomes an appointment) or declines (the hold is
// released). Nothing is sent to the patient automatically.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand, runQuery, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import {
  activePatient,
  confirmHeldReservation,
  createBookingParty,
  facilityToday,
  placeHold,
  type AppointmentResult,
  type BookingPartyInput,
} from './appointments.ts';

export const OFFER_HOLD_MINUTES = 15;
const MAX_RANGE_DAYS = 60;

export interface WaitlistEntryView {
  waitlistEntryId: string;
  status: string;
  facilityId: string | null;
  staffId: string | null;
  practitionerName: string | null;
  preferredFrom: string;
  preferredTo: string;
  notes: string | null;
  bookingPartyId: string;
  bookingPartyName: string;
  bookingPartyPhone: string | null;
  patientId: string | null;
  patientName: string | null;
  createdAt: Date;
  offer: { offerId: string; slotStart: Date; slotEnd: Date; expiresAt: Date } | null;
}

/** Active requests (waiting or offered) at a clinic, oldest first. An offer past its expiry reads as waiting. */
export async function listWaitlist(
  db: Kysely<DB>,
  caller: Caller,
  f: { facilityId: string; status?: string | undefined; staffId?: string | undefined },
): Promise<WaitlistEntryView[]> {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<WaitlistEntryView & { offerId: string | null; slotStart: Date | null; slotEnd: Date | null; expiresAt: Date | null }>`
      SELECT * FROM (
        SELECT e.id AS "waitlistEntryId",
               CASE WHEN e.status = 'offered' AND o.id IS NULL THEN 'waiting' ELSE e.status END AS status,
               e.facility_id AS "facilityId", e.practitioner_staff_id AS "staffId", s.display_name AS "practitionerName",
               e.preferred_from::text AS "preferredFrom", e.preferred_to::text AS "preferredTo", e.notes,
               bp.id AS "bookingPartyId", bp.name AS "bookingPartyName", bp.phone AS "bookingPartyPhone", bp.patient_id AS "patientId",
               p.given_name || coalesce(' ' || p.family_name, '') AS "patientName", e.created_at AS "createdAt",
               o.id AS "offerId", lower(r.period) AS "slotStart", upper(r.period) AS "slotEnd", o.expires_at AS "expiresAt"
        FROM booking.waitlist_entry e
        JOIN booking.booking_party bp ON bp.id = e.booking_party_id
        LEFT JOIN platform.staff s ON s.id = e.practitioner_staff_id
        LEFT JOIN patient.patient p ON p.id = bp.patient_id
        LEFT JOIN booking.waitlist_offer o ON o.waitlist_entry_id = e.id AND o.outcome = 'pending' AND o.expires_at > ${now}
        LEFT JOIN booking.reservation r ON r.id = o.reservation_id
        WHERE e.facility_id = ${f.facilityId}
          AND (${f.staffId ?? null}::uuid IS NULL OR e.practitioner_staff_id = ${f.staffId ?? null})
      ) w
      WHERE ${f.status ? sql`w.status = ${f.status}` : sql`w.status IN ('waiting', 'offered')`}
      ORDER BY w."createdAt", w."waitlistEntryId"
      LIMIT 200`.execute(tx);
    return rows.map(({ offerId, slotStart, slotEnd, expiresAt, ...entry }) => ({
      ...entry,
      offer: offerId ? { offerId, slotStart: slotStart!, slotEnd: slotEnd!, expiresAt: expiresAt! } : null,
    }));
  });
}

/** Clinic of a waitlist request, for authorization; undefined when not found, null when it has none. */
export async function waitlistFacility(db: Kysely<DB>, caller: Caller, entryId: string): Promise<string | null | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('booking.waitlist_entry').select('facility_id').where('id', '=', entryId).executeTakeFirst())?.facility_id,
  );
}

/** Clinic of the request an offer belongs to, for authorization. */
export async function waitlistOfferFacility(db: Kysely<DB>, caller: Caller, offerId: string): Promise<string | null | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (
      await tx
        .selectFrom('booking.waitlist_offer as o')
        .innerJoin('booking.waitlist_entry as e', 'e.id', 'o.waitlist_entry_id')
        .select('e.facility_id')
        .where('o.id', '=', offerId)
        .executeTakeFirst()
    )?.facility_id,
  );
}

export interface AddToWaitlistInput {
  facilityId: string;
  staffId: string;
  preferredFrom: string;
  preferredTo: string;
  bookingParty: BookingPartyInput & { phone: string };
  patientId?: string | undefined;
  notes?: string | undefined;
}

export async function addToWaitlist(db: Kysely<DB>, caller: Caller, input: AddToWaitlistInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.waitlist_add', idempotencyKey, request: input }, async (ctx) => {
    const today = await facilityToday(ctx.tx, input.facilityId, now);
    if (input.preferredTo < input.preferredFrom) throw invalid('preferredTo must not be before preferredFrom');
    if (input.preferredTo < today) throw invalid('the requested dates have already passed');
    const { rows: [span] } = await sql<{ days: number }>`SELECT ${input.preferredTo}::date - ${input.preferredFrom}::date AS days`.execute(ctx.tx);
    if (span!.days > MAX_RANGE_DAYS) throw invalid(`a request can cover at most ${MAX_RANGE_DAYS} days`);
    const affiliated = await ctx.tx
      .selectFrom('catalog.practitioner_affiliation')
      .select('id')
      .where('staff_id', '=', input.staffId)
      .where('facility_id', '=', input.facilityId)
      .where('valid_from', '<=', input.preferredTo)
      .where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', today)]))
      .executeTakeFirst();
    if (!affiliated) throw invalid('this doctor does not practise at this clinic');
    if (input.patientId) await activePatient(ctx.tx, input.patientId);
    const bookingPartyId = await createBookingParty(ctx, input.bookingParty, input.patientId ?? null, now);
    const { id } = await ctx.tx
      .insertInto('booking.waitlist_entry')
      .values({
        tenant_id: ctx.tenantId,
        booking_party_id: bookingPartyId,
        practitioner_staff_id: input.staffId,
        facility_id: input.facilityId,
        preferred_from: input.preferredFrom,
        preferred_to: input.preferredTo,
        notes: input.notes ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'booking.waitlist_entry', subjectId: id, patientId: input.patientId ?? null });
    return { waitlistEntryId: id, status: 'waiting' };
  });
}

/** Locks a request and lapses its expired offer, so every command sees the current state. */
async function lockEntry(ctx: CommandContext, entryId: string, now: Date) {
  const entry = await ctx.tx
    .selectFrom('booking.waitlist_entry')
    .select(['id', 'status', 'facility_id', 'practitioner_staff_id', 'preferred_from', 'preferred_to', 'booking_party_id'])
    .where('id', '=', entryId)
    .forUpdate()
    .executeTakeFirst();
  if (!entry) throw notFound('waitlist request', { waitlistEntryId: entryId });
  const lapsed = await ctx.tx
    .updateTable('booking.waitlist_offer')
    .set({ outcome: 'expired' })
    .where('waitlist_entry_id', '=', entryId)
    .where('outcome', '=', 'pending')
    .where('expires_at', '<=', now)
    .returning('id')
    .execute();
  for (const offer of lapsed) ctx.emit({eventType:'waitlist.offer_closed',aggregateType:'booking.waitlist_offer',aggregateId:offer.id,payload:{offerId:offer.id,outcome:'expired'}});
  if (lapsed.length && entry.status === 'offered') {
    await ctx.tx.updateTable('booking.waitlist_entry').set({ status: 'waiting' }).where('id', '=', entryId).execute();
    entry.status = 'waiting';
  }
  return entry;
}

async function pendingOffer(ctx: CommandContext, entryId: string) {
  return ctx.tx
    .selectFrom('booking.waitlist_offer')
    .select(['id', 'reservation_id'])
    .where('waitlist_entry_id', '=', entryId)
    .where('outcome', '=', 'pending')
    .forUpdate()
    .executeTakeFirst();
}

async function entryOfOffer(ctx: CommandContext, offerId: string): Promise<string> {
  const row = await ctx.tx.selectFrom('booking.waitlist_offer').select('waitlist_entry_id').where('id', '=', offerId).executeTakeFirst();
  if (!row) throw notFound('waitlist offer', { offerId });
  return row.waitlist_entry_id;
}

/** Holds one free slot of the requested doctor, at the request's clinic and within its dates, for 15 minutes. */
export async function offerWaitlistSlot(db: Kysely<DB>, caller: Caller, input: { waitlistEntryId: string; slotStart: string }, idempotencyKey?: string) {
  const now = clock(caller);
  const result = await runCommand(db, { ...caller, module: 'booking', name: 'booking.waitlist_offer', idempotencyKey, request: input }, async (ctx) => {
    const entry = await lockEntry(ctx, input.waitlistEntryId, now);
    if (entry.status !== 'waiting') throw conflict(`this request is ${entry.status}, not waiting`, { reason: 'not_waiting' });
    if (!entry.practitioner_staff_id || !entry.facility_id) throw preconditionFailed('this request has no doctor and clinic to offer a slot for');
    const { rows: [inRange] } = await sql<{ ok: boolean }>`
      SELECT ((${input.slotStart}::timestamptz) AT TIME ZONE f.timezone)::date BETWEEN ${entry.preferred_from}::date AND ${entry.preferred_to}::date AS ok
      FROM platform.facility f WHERE f.id = ${entry.facility_id}`.execute(ctx.tx);
    if (!inRange?.ok) throw invalid('the slot is outside the dates the caller asked for');
    const offerId = (await sql<{ id: string }>`SELECT uuidv7() AS id`.execute(ctx.tx)).rows[0]!.id;
    // The clinic check makes a slot of the same doctor at another clinic fail as slot_unavailable.
    const hold = await placeHold(
      ctx,
      now,
      { staffId: entry.practitioner_staff_id, slotStart: input.slotStart, facilityId: entry.facility_id },
      OFFER_HOLD_MINUTES,
      { type: 'waitlist_offer', id: offerId },
    );
    await ctx.tx
      .insertInto('booking.waitlist_offer')
      .values({ id: offerId, tenant_id: ctx.tenantId, waitlist_entry_id: entry.id, reservation_id: hold.reservationId, offered_at: now, expires_at: hold.holdExpiresAt })
      .execute();
    await ctx.tx.updateTable('booking.waitlist_entry').set({ status: 'offered' }).where('id', '=', entry.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.waitlist_entry', subjectId: entry.id, diff: { status: 'offered', offerId } });
    ctx.emit({eventType:'waitlist.offered',aggregateType:'booking.waitlist_offer',aggregateId:offerId,payload:{offerId}});
    return { offerId, waitlistEntryId: entry.id, slotStart: hold.slotStart, slotEnd: hold.slotEnd, expiresAt: hold.holdExpiresAt };
  });
  return { ...result, slotStart: new Date(result.slotStart), slotEnd: new Date(result.slotEnd), expiresAt: new Date(result.expiresAt) };
}

/** The caller said yes: the held slot becomes their appointment and the request closes. */
export async function acceptWaitlistOffer(db: Kysely<DB>, caller: Caller, input: { offerId: string }, idempotencyKey?: string): Promise<AppointmentResult> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.waitlist_accept', idempotencyKey, request: input }, async (ctx) => {
    const entry = await lockEntry(ctx, await entryOfOffer(ctx, input.offerId), now);
    const offer = await pendingOffer(ctx, entry.id);
    if (!offer || offer.id !== input.offerId) throw preconditionFailed('this offer has expired or was answered; offer a slot again', { reason: 'offer_expired' });
    const party = await ctx.tx.selectFrom('booking.booking_party').select('patient_id').where('id', '=', entry.booking_party_id).executeTakeFirstOrThrow();
    if (party.patient_id) await activePatient(ctx.tx, party.patient_id);
    const appointment = await confirmHeldReservation(ctx, now, offer.reservation_id, {
      patientId: party.patient_id,
      bookingPartyId: entry.booking_party_id,
      visitType: 'new',
      originChannel: 'front_desk',
      priority: 'normal',
      reason: null,
      rescheduledFromId: null,
    });
    await ctx.tx.updateTable('booking.waitlist_offer').set({ outcome: 'accepted', updated_by: ctx.actor.staffId ?? null }).where('id', '=', offer.id).execute();
    await ctx.tx.updateTable('booking.waitlist_entry').set({ status: 'accepted' }).where('id', '=', entry.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.waitlist_entry', subjectId: entry.id, patientId: party.patient_id, diff: { status: 'accepted', appointmentId: appointment.appointmentId } });
    ctx.emit({eventType:'waitlist.offer_closed',aggregateType:'booking.waitlist_offer',aggregateId:offer.id,payload:{offerId:offer.id,outcome:'accepted'}});
    return appointment;
  });
}

async function closeOffer(ctx: CommandContext, offer: { id: string; reservation_id: string }) {
  ctx.emit({eventType:'waitlist.offer_closed',aggregateType:'booking.waitlist_offer',aggregateId:offer.id,payload:{offerId:offer.id,outcome:'declined'}});
  await ctx.tx.updateTable('booking.waitlist_offer').set({ outcome: 'declined', updated_by: ctx.actor.staffId ?? null }).where('id', '=', offer.id).execute();
  await ctx.tx.updateTable('booking.reservation').set({ status: 'released' }).where('id', '=', offer.reservation_id).where('status', '=', 'held').execute();
}

/** The caller said no: the slot is released and the request waits again. */
export async function declineWaitlistOffer(db: Kysely<DB>, caller: Caller, input: { offerId: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.waitlist_decline', idempotencyKey, request: input }, async (ctx) => {
    const entry = await lockEntry(ctx, await entryOfOffer(ctx, input.offerId), now);
    const offer = await pendingOffer(ctx, entry.id);
    if (!offer || offer.id !== input.offerId) throw preconditionFailed('this offer has expired or was answered', { reason: 'offer_expired' });
    await closeOffer(ctx, offer);
    await ctx.tx.updateTable('booking.waitlist_entry').set({ status: 'waiting' }).where('id', '=', entry.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.waitlist_entry', subjectId: entry.id, diff: { status: 'waiting', declinedOfferId: offer.id } });
    return { waitlistEntryId: entry.id, status: 'waiting' };
  });
}

/** Removes a request; a pending offer is declined and its slot released. */
export async function withdrawFromWaitlist(db: Kysely<DB>, caller: Caller, input: { waitlistEntryId: string; reason: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.waitlist_withdraw', idempotencyKey, request: input }, async (ctx) => {
    const entry = await lockEntry(ctx, input.waitlistEntryId, now);
    if (!['waiting', 'offered'].includes(entry.status)) throw conflict(`this request is already ${entry.status}`, { reason: 'not_active' });
    const offer = await pendingOffer(ctx, entry.id);
    if (offer) await closeOffer(ctx, offer);
    await ctx.tx.updateTable('booking.waitlist_entry').set({ status: 'withdrawn' }).where('id', '=', entry.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.waitlist_entry', subjectId: entry.id, reason: input.reason, diff: { status: 'withdrawn' } });
    return { waitlistEntryId: entry.id, status: 'withdrawn' };
  });
}

/** Addressable offer history, including closed offers that disappear from the active list.
 * Expiry is derived on reads; it must never be mistaken for a successful decline. */
export async function getWaitlistOffer(db: Kysely<DB>, caller: Caller, offerId: string) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: [offer] } = await sql<{
      offerId: string; waitlistEntryId: string; facilityId: string | null;
      outcome: string; version: number; closedByStaffId: string | null;
      closedAt: Date | null; expiresAt: Date; appointmentId: string | null;
    }>`SELECT o.id AS "offerId", o.waitlist_entry_id AS "waitlistEntryId",
      e.facility_id AS "facilityId",
      CASE WHEN o.outcome = 'pending' AND o.expires_at <= ${now} THEN 'expired' ELSE o.outcome END AS outcome,
      o.version,
      CASE WHEN o.outcome IN ('accepted', 'declined') THEN o.updated_by ELSE NULL END AS "closedByStaffId",
      CASE WHEN o.outcome = 'expired' OR (o.outcome = 'pending' AND o.expires_at <= ${now}) THEN o.expires_at
           WHEN o.outcome IN ('accepted', 'declined') THEN o.updated_at ELSE NULL END AS "closedAt",
      o.expires_at AS "expiresAt", a.id AS "appointmentId"
      FROM booking.waitlist_offer o
      JOIN booking.waitlist_entry e ON e.id = o.waitlist_entry_id
      LEFT JOIN booking.appointment a ON a.reservation_id = o.reservation_id
      WHERE o.id = ${offerId}`.execute(tx);
    if (!offer) throw notFound('waitlist offer', { offerId });
    return offer;
  });
}
