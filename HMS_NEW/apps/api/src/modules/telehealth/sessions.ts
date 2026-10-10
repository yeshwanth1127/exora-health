// Virtual OPD lifecycle. One tele_session per virtual appointment:
//   scheduled ─(patient consents + enters waiting room)→ waiting ─(assigned doctor starts)→ in_progress
//   ─(doctor ends the call)→ completed;   scheduled|waiting → cancelled | no_show with the appointment.
// The patient acts through a join link (no account); the doctor through their staff login. Ending the
// call does not finish the visit: the doctor finishes the encounter as for any OPD consultation.
import { createHash, randomBytes } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { DomainError, forbidden, invalid, notFound, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import type { TelehealthSettings } from '../../config.ts';
import { mintJitsiGrant, type JoinGrant } from './jitsi.ts';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newRoomName = () => `tc${randomBytes(16).toString('hex')}`;

type ActorKind = 'staff' | 'patient' | 'system';
type EventType =
  | 'created' | 'link_issued' | 'consent_recorded' | 'patient_waiting' | 'started' | 'join_granted'
  | 'patient_left' | 'identity_verified' | 'ended' | 'cancelled' | 'no_show';

export async function logSessionEvent(
  tx: Transaction<DB>,
  tenantId: string,
  sessionId: string,
  eventType: EventType,
  actor: { kind: ActorKind; staffId?: string | undefined },
  at: Date,
  detail: Record<string, unknown> = {},
) {
  const kind = actor.kind === 'staff' && actor.staffId ? 'staff' : actor.kind === 'staff' ? 'system' : actor.kind;
  await tx
    .insertInto('clinical.tele_session_event')
    .values({
      tenant_id: tenantId,
      session_id: sessionId,
      event_type: eventType,
      actor_kind: kind,
      actor_staff_id: kind === 'staff' ? actor.staffId! : null,
      detail: JSON.stringify(detail),
      occurred_at: at,
    })
    .execute();
}

// ---------------------------------------------------------------------------
// Creation (worker consumer on appointment.confirmed, or on demand when a link is issued)
// ---------------------------------------------------------------------------

/** Creates the session for a virtual appointment if it doesn't exist. Returns null for other appointments. */
export async function ensureSessionForAppointment(tx: Transaction<DB>, tenantId: string, appointmentId: string, at: Date): Promise<string | null> {
  const existing = await tx.selectFrom('clinical.tele_session').select('id').where('appointment_id', '=', appointmentId).executeTakeFirst();
  if (existing) return existing.id;
  const appt = await tx
    .selectFrom('booking.appointment')
    .select(['id', 'visit_mode', 'status', 'facility_id', 'practitioner_staff_id'])
    .where('id', '=', appointmentId)
    .executeTakeFirst();
  if (!appt) throw notFound('appointment', { appointmentId });
  if (appt.visit_mode !== 'virtual' || !['confirmed', 'checked_in'].includes(appt.status)) return null;
  const inserted = await tx
    .insertInto('clinical.tele_session')
    .values({
      tenant_id: tenantId,
      appointment_id: appt.id,
      facility_id: appt.facility_id,
      practitioner_staff_id: appt.practitioner_staff_id,
      room_name: newRoomName(),
    })
    .onConflict((oc) => oc.columns(['tenant_id', 'appointment_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) {
    return (await tx.selectFrom('clinical.tele_session').select('id').where('appointment_id', '=', appointmentId).executeTakeFirstOrThrow()).id;
  }
  await logSessionEvent(tx, tenantId, inserted.id, 'created', { kind: 'system' }, at);
  return inserted.id;
}

/** Consumer step: the appointment was cancelled or marked no-show — close the session and revoke its link. */
export async function closeSessionForAppointment(tx: Transaction<DB>, tenantId: string, appointmentId: string, outcome: 'cancelled' | 'no_show', at: Date) {
  const from = outcome === 'cancelled' ? ['scheduled', 'waiting', 'in_progress'] : ['scheduled', 'waiting'];
  const closed = await tx
    .updateTable('clinical.tele_session')
    .set({ status: outcome, patient_link_hash: null, patient_link_expires_at: null })
    .where('appointment_id', '=', appointmentId)
    .where('status', 'in', from)
    .returning('id')
    .executeTakeFirst();
  if (closed) await logSessionEvent(tx, tenantId, closed.id, outcome, { kind: 'system' }, at);
}

// ---------------------------------------------------------------------------
// Shared checks
// ---------------------------------------------------------------------------

interface LockedSession {
  id: string;
  appointment_id: string;
  facility_id: string;
  practitioner_staff_id: string;
  room_name: string;
  status: string;
  identity_verified_at: Date | null;
  appointment_status: string;
  starts_at: Date;
  ends_at: Date;
  patient_id: string | null;
  patient_name: string | null;
}

async function lockSession(tx: Transaction<DB>, where: { sessionId: string } | { appointmentId: string }): Promise<LockedSession> {
  let q = tx
    .selectFrom('clinical.tele_session as s')
    .innerJoin('booking.appointment as a', 'a.id', 's.appointment_id')
    .leftJoin('patient.patient as p', 'p.id', 'a.patient_id')
    .leftJoin('booking.booking_party as bp', 'bp.id', 'a.booking_party_id')
    .select([
      's.id', 's.appointment_id', 's.facility_id', 's.practitioner_staff_id', 's.room_name', 's.status', 's.identity_verified_at',
      'a.status as appointment_status', 'a.starts_at', 'a.ends_at', 'a.patient_id',
    ])
    .select(sql<string | null>`coalesce(p.given_name || coalesce(' ' || p.family_name, ''), bp.name)`.as('patient_name'))
    .forUpdate('s');
  q = 'sessionId' in where ? q.where('s.id', '=', where.sessionId) : q.where('s.appointment_id', '=', where.appointmentId);
  const row = await q.executeTakeFirst();
  if (!row) throw notFound('teleconsultation');
  if (!row.starts_at || !row.ends_at) throw preconditionFailed('teleconsultation has no scheduled time');
  return row as LockedSession;
}

function joinWindow(settings: TelehealthSettings, s: { starts_at: Date; ends_at: Date }) {
  return {
    opensAt: new Date(s.starts_at.getTime() - settings.joinEarlyMinutes * 60_000),
    closesAt: new Date(s.ends_at.getTime() + settings.joinLateMinutes * 60_000),
  };
}

function assertInWindow(settings: TelehealthSettings, s: { starts_at: Date; ends_at: Date }, now: Date) {
  const { opensAt, closesAt } = joinWindow(settings, s);
  if (now < opensAt) throw preconditionFailed('the consultation opens closer to its start time', { reason: 'too_early', opensAt: opensAt.toISOString() });
  if (now > closesAt) throw preconditionFailed('the time for this consultation has passed', { reason: 'too_late', closesAt: closesAt.toISOString() });
}

function assertAssignedDoctor(ctx: CommandContext, s: LockedSession) {
  if (!ctx.actor.staffId || ctx.actor.staffId !== s.practitioner_staff_id) {
    throw forbidden('only the doctor this consultation is booked with can do this', { reason: 'not_assigned_doctor' });
  }
}

/** The tenant's current published consent document (the teleconsultation on/off switch). */
export async function currentConsentDocument(tx: Transaction<DB>, now: Date, language = 'en') {
  const doc = await tx
    .selectFrom('clinical.tele_consent_document')
    .select(['id', 'doc_version', 'language', 'title', 'body'])
    .where('language', '=', language)
    .where('published_at', '<=', now)
    .where((eb) => eb.or([eb('retired_at', 'is', null), eb('retired_at', '>', now)]))
    .orderBy('published_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  return doc ?? null;
}

async function requireConsentDocument(tx: Transaction<DB>, now: Date) {
  const doc = await currentConsentDocument(tx, now);
  if (!doc) throw preconditionFailed('video consultations are not set up for this hospital (no published consent document)', { reason: 'teleconsult_not_configured' });
  return doc;
}

export async function hasCurrentConsent(tx: Transaction<DB>, sessionId: string, now: Date): Promise<boolean> {
  const doc = await currentConsentDocument(tx, now);
  if (!doc) return false;
  const row = await tx.selectFrom('clinical.tele_consent').select('id').where('session_id', '=', sessionId).where('document_id', '=', doc.id).executeTakeFirst();
  return !!row;
}

async function recordConsent(
  ctx: CommandContext,
  s: LockedSession,
  now: Date,
  input: { documentVersion: string; method: 'patient_link' | 'verbal_recorded_by_staff'; ipHash?: string | undefined; userAgentHash?: string | undefined; note?: string | undefined },
) {
  if (!['scheduled', 'waiting', 'in_progress'].includes(s.status)) throw preconditionFailed(`a ${s.status} consultation does not take consent`);
  const doc = await requireConsentDocument(ctx.tx, now);
  if (doc.doc_version !== input.documentVersion) {
    throw preconditionFailed('the consent text has changed; read and accept the current version', { reason: 'consent_version_changed', currentVersion: doc.doc_version });
  }
  const inserted = await ctx.tx
    .insertInto('clinical.tele_consent')
    .values({
      tenant_id: ctx.tenantId,
      session_id: s.id,
      document_id: doc.id,
      method: input.method,
      accepted_at: now,
      recorded_by_staff_id: input.method === 'verbal_recorded_by_staff' ? ctx.actor.staffId! : null,
      client_ip_hash: input.ipHash ?? null,
      user_agent_hash: input.userAgentHash ?? null,
      note: input.note ?? null,
    })
    .onConflict((oc) => oc.columns(['tenant_id', 'session_id', 'document_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) return; // already consented to this version
  await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'consent_recorded', ctx.actor, now, { documentVersion: doc.doc_version, method: input.method });
  ctx.audit({ action: 'create', subjectType: 'clinical.tele_consent', subjectId: inserted.id, patientId: s.patient_id, reason: input.method });
  ctx.emit({ eventType: 'teleconsult.consent_recorded', aggregateType: 'clinical.tele_session', aggregateId: s.id, payload: { sessionId: s.id, appointmentId: s.appointment_id, documentVersion: doc.doc_version, method: input.method } });
}

// ---------------------------------------------------------------------------
// Staff: front desk
// ---------------------------------------------------------------------------

export interface PatientLink {
  sessionId: string;
  token: string;
  url: string;
  expiresAt: string;
}

/**
 * Issues (or re-issues) the patient's join link. The token is returned once and stored only as a
 * hash; issuing again invalidates the previous link. No idempotency key on purpose: the stored
 * result would contain the token.
 */
export async function issuePatientLink(db: Kysely<DB>, caller: Caller, settings: TelehealthSettings, input: { appointmentId: string }): Promise<PatientLink> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.issue_tele_link', request: input }, async (ctx) => {
    await requireConsentDocument(ctx.tx, now);
    const sessionId = await ensureSessionForAppointment(ctx.tx, ctx.tenantId, input.appointmentId, now);
    if (!sessionId) throw preconditionFailed('this is not an active video appointment', { reason: 'not_virtual' });
    const s = await lockSession(ctx.tx, { sessionId });
    if (!['scheduled', 'waiting', 'in_progress'].includes(s.status)) throw preconditionFailed(`a ${s.status} consultation cannot be joined`);
    const { closesAt } = joinWindow(settings, s);
    if (closesAt <= now) throw preconditionFailed('the time for this consultation has passed', { reason: 'too_late' });
    const token = randomBytes(32).toString('base64url');
    await ctx.tx
      .updateTable('clinical.tele_session')
      .set({ patient_link_hash: sha256(token), patient_link_issued_at: now, patient_link_expires_at: closesAt })
      .where('id', '=', s.id)
      .execute();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'link_issued', ctx.actor, now, { expiresAt: closesAt.toISOString() });
    ctx.audit({ action: 'update', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id, reason: 'patient join link issued' });
    ctx.emit({ eventType: 'teleconsult.link_issued', aggregateType: 'clinical.tele_session', aggregateId: s.id, payload: { sessionId: s.id, appointmentId: s.appointment_id, expiresAt: closesAt.toISOString() } });
    return { sessionId: s.id, token, url: `${settings.patientLinkBase}#t=${token}`, expiresAt: closesAt.toISOString() };
  });
}

/** Staff record consent the patient gave by phone or on the call (the guidelines allow audio/video consent). */
export async function recordVerbalConsent(db: Kysely<DB>, caller: Caller, input: { sessionId: string; documentVersion: string; note: string }) {
  if (input.note.trim().length < 5) throw invalid('say how and when the patient consented');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_tele_consent', request: input }, async (ctx) => {
    if (!ctx.actor.staffId) throw forbidden('only staff can record verbal consent');
    const s = await lockSession(ctx.tx, { sessionId: input.sessionId });
    await recordConsent(ctx, s, now, { documentVersion: input.documentVersion, method: 'verbal_recorded_by_staff', note: input.note.trim() });
    return { sessionId: s.id, consented: true };
  });
}

// ---------------------------------------------------------------------------
// Staff: the assigned doctor
// ---------------------------------------------------------------------------

export async function startTeleconsult(db: Kysely<DB>, caller: Caller, settings: TelehealthSettings, input: { sessionId: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.start_teleconsult', request: input }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: input.sessionId });
    assertAssignedDoctor(ctx, s);
    if (s.status === 'in_progress') return { sessionId: s.id, status: 'in_progress' as const };
    if (!['scheduled', 'waiting'].includes(s.status)) throw preconditionFailed(`a ${s.status} consultation cannot be started`);
    if (s.appointment_status !== 'checked_in') {
      throw preconditionFailed('the patient is not checked in yet: they check in by entering the waiting room, or the front desk checks them in', { reason: 'patient_not_checked_in' });
    }
    assertInWindow(settings, s, now);
    const updated = await ctx.tx
      .updateTable('clinical.tele_session')
      .set({ status: 'in_progress', started_at: now })
      .where('id', '=', s.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'started', ctx.actor, now);
    ctx.audit({ action: 'status_change', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id });
    ctx.emit({ eventType: 'teleconsult.started', aggregateType: 'clinical.tele_session', aggregateId: s.id, aggregateVersion: updated.version, payload: { sessionId: s.id, appointmentId: s.appointment_id } });
    return { sessionId: s.id, status: 'in_progress' as const };
  });
}

export async function doctorJoinGrant(db: Kysely<DB>, caller: Caller, settings: TelehealthSettings, input: { sessionId: string }): Promise<JoinGrant> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_join_doctor', request: input }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: input.sessionId });
    assertAssignedDoctor(ctx, s);
    if (s.status !== 'in_progress') throw preconditionFailed('start the consultation before joining', { reason: 'not_started' });
    assertInWindow(settings, s, now);
    const staff = await ctx.tx.selectFrom('platform.staff').select('display_name').where('id', '=', ctx.actor.staffId!).executeTakeFirstOrThrow();
    const grant = await mintJitsiGrant(settings, { roomName: s.room_name, userId: `staff:${ctx.actor.staffId}`, displayName: staff.display_name, moderator: true, now });
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'join_granted', ctx.actor, now, { role: grant.role });
    ctx.audit({ action: 'view', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id, reason: 'joined video consultation' });
    return grant;
  });
}

export type IdentityMethod = 'known_patient' | 'photo_id' | 'abha' | 'verified_by_staff';

/** Telemedicine Practice Guidelines 2020: the doctor confirms who the patient is, and how. */
export async function verifyPatientIdentity(db: Kysely<DB>, caller: Caller, input: { sessionId: string; method: IdentityMethod; note?: string | undefined }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_verify_identity', request: input }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: input.sessionId });
    assertAssignedDoctor(ctx, s);
    if (s.status !== 'in_progress') throw preconditionFailed('identity is confirmed during the consultation');
    await ctx.tx
      .updateTable('clinical.tele_session')
      .set({ identity_method: input.method, identity_verified_by: ctx.actor.staffId!, identity_verified_at: now, identity_note: input.note ?? null })
      .where('id', '=', s.id)
      .execute();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'identity_verified', ctx.actor, now, { method: input.method });
    ctx.audit({ action: 'update', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id, reason: `identity: ${input.method}` });
    return { sessionId: s.id, identityMethod: input.method, verifiedAt: now.toISOString() };
  });
}

export type EndOutcome = 'consulted' | 'patient_did_not_join' | 'technical_failure';

/** Ends the call. The visit itself is finished on the encounter (notes, diagnosis, disposition). */
export async function endTeleconsult(db: Kysely<DB>, caller: Caller, input: { sessionId: string; outcome: EndOutcome; note?: string | undefined }) {
  const now = clock(caller);
  if (input.outcome !== 'consulted' && !input.note?.trim()) throw invalid('add a note when the consultation did not take place');
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.end_teleconsult', request: input }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: input.sessionId });
    assertAssignedDoctor(ctx, s);
    if (s.status === 'completed') return { sessionId: s.id, status: 'completed' as const };
    if (s.status !== 'in_progress') throw preconditionFailed(`a ${s.status} consultation cannot be ended`);
    if (input.outcome === 'consulted' && !s.identity_verified_at) {
      throw preconditionFailed("confirm the patient's identity before ending a consultation that took place", { reason: 'identity_not_verified' });
    }
    const updated = await ctx.tx
      .updateTable('clinical.tele_session')
      .set({ status: 'completed', ended_at: now, ended_by: ctx.actor.staffId!, end_outcome: input.outcome, end_note: input.note ?? null, patient_link_hash: null, patient_link_expires_at: null })
      .where('id', '=', s.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'ended', ctx.actor, now, { outcome: input.outcome });
    ctx.audit({ action: 'status_change', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id, reason: input.outcome });
    ctx.emit({ eventType: 'teleconsult.ended', aggregateType: 'clinical.tele_session', aggregateId: s.id, aggregateVersion: updated.version, payload: { sessionId: s.id, appointmentId: s.appointment_id, outcome: input.outcome } });
    return { sessionId: s.id, status: 'completed' as const };
  });
}

// ---------------------------------------------------------------------------
// Patient: through the join link
// ---------------------------------------------------------------------------

export interface LinkCaller extends Caller {
  sessionId: string;
}

export class LinkError extends DomainError {}

/** Resolves a join-link token to its tenant and session. Unknown and expired links look the same. */
export async function resolvePatientLink(db: Kysely<DB>, token: string, now: Date): Promise<{ tenantId: string; sessionId: string }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new LinkError('forbidden', 'this video consultation link is not valid', { reason: 'invalid_link' });
  const { rows: [row] } = await sql<{ tenant_id: string; session_id: string; expires_at: Date }>`
    SELECT * FROM clinical.resolve_tele_link(${sha256(token)})`.execute(db);
  if (!row || row.expires_at <= now) throw new LinkError('forbidden', 'this video consultation link is not valid or has expired', { reason: 'invalid_link' });
  return { tenantId: row.tenant_id, sessionId: row.session_id };
}

export async function patientConsent(db: Kysely<DB>, caller: LinkCaller, input: { documentVersion: string; ipHash?: string | undefined; userAgentHash?: string | undefined }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_patient_consent', request: { sessionId: caller.sessionId, ...input } }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: caller.sessionId });
    await recordConsent(ctx, s, now, { ...input, method: 'patient_link' });
    return { consented: true };
  });
}

/** The patient enters the waiting room. If their record is linked, the worker checks the appointment in. */
export async function patientCheckIn(db: Kysely<DB>, caller: LinkCaller, settings: TelehealthSettings) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_patient_check_in', request: { sessionId: caller.sessionId } }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: caller.sessionId });
    if (s.status === 'waiting' || s.status === 'in_progress') return { status: s.status };
    if (s.status !== 'scheduled') throw preconditionFailed(`this consultation is ${s.status}`);
    if (!(await hasCurrentConsent(ctx.tx, s.id, now))) throw preconditionFailed('accept the consent before entering the waiting room', { reason: 'consent_required' });
    assertInWindow(settings, s, now);
    const updated = await ctx.tx
      .updateTable('clinical.tele_session')
      .set({ status: 'waiting', patient_waiting_since: now, patient_left_at: null })
      .where('id', '=', s.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'patient_waiting', ctx.actor, now);
    ctx.audit({ action: 'status_change', subjectType: 'clinical.tele_session', subjectId: s.id, patientId: s.patient_id, reason: 'patient entered waiting room' });
    ctx.emit({
      eventType: 'teleconsult.patient_waiting',
      aggregateType: 'clinical.tele_session',
      aggregateId: s.id,
      aggregateVersion: updated.version,
      payload: { sessionId: s.id, appointmentId: s.appointment_id, at: now.toISOString() },
    });
    return { status: 'waiting' as const };
  });
}

export async function patientJoinGrant(db: Kysely<DB>, caller: LinkCaller, settings: TelehealthSettings): Promise<JoinGrant> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_join_patient', request: { sessionId: caller.sessionId } }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: caller.sessionId });
    if (!(await hasCurrentConsent(ctx.tx, s.id, now))) throw preconditionFailed('accept the consent before joining', { reason: 'consent_required' });
    if (s.status !== 'in_progress') throw preconditionFailed('the doctor has not started the consultation yet', { reason: 'doctor_not_ready' });
    assertInWindow(settings, s, now);
    const grant = await mintJitsiGrant(settings, { roomName: s.room_name, userId: `patient:${s.id}`, displayName: s.patient_name ?? 'Patient', moderator: false, now });
    await ctx.tx.updateTable('clinical.tele_session').set({ patient_left_at: null }).where('id', '=', s.id).execute();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'join_granted', ctx.actor, now, { role: grant.role });
    return grant;
  });
}

/** The patient closed the call. Recorded only; the consultation goes on until the doctor ends it. */
export async function patientLeave(db: Kysely<DB>, caller: LinkCaller) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.tele_patient_leave', request: { sessionId: caller.sessionId } }, async (ctx) => {
    const s = await lockSession(ctx.tx, { sessionId: caller.sessionId });
    if (s.status !== 'waiting' && s.status !== 'in_progress') return { status: s.status };
    await ctx.tx.updateTable('clinical.tele_session').set({ patient_left_at: now }).where('id', '=', s.id).execute();
    await logSessionEvent(ctx.tx, ctx.tenantId, s.id, 'patient_left', ctx.actor, now);
    return { status: s.status };
  });
}

export { joinWindow };
