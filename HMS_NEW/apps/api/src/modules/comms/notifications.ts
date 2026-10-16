// First notifications slice: persistent readback and consent, with deliberately non-delivering log transport.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import {
  conflict,
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
  setTransactionContext,
  writeAudit,
  writeOutbox,
} from '@hms/platform';
import {
  AppointmentMessagesResponseSchema,
  AppointmentNotificationEventSchema,
  AppointmentRescheduledEventSchema,
  FollowupRuleSchema,
  FollowupRulesResponseSchema,
  NotificationJobSchema,
  type FollowupRuleUpsert,
  type AppointmentFollowupCreate,
  type NotificationHistoryQuery,
  CommsCapabilitiesSchema,
  ContactPointSchema,
  type ContactPointCreate,
  type MessagingConsentCreate,
} from '@hms/contracts';
import { cancelAddressWork } from './whatsapp.ts';
import { clock, type Caller } from '../../caller.ts';
import type { OutboxEvent } from '../../../../worker/src/dispatcher.ts';

type Tx = Transaction<DB>;
export async function moduleState(tx: Tx) {
  return (
    (await tx.selectFrom('platform.module_state').select('state').where('module_code', '=', 'comms').executeTakeFirst())
      ?.state ?? 'active'
  );
}
async function active(tx: Tx) {
  const state = await moduleState(tx);
  if (state !== 'active')
    throw preconditionFailed('communications module is inactive', { reason: 'module_inactive', state });
}
export async function addressLock(tx: Tx, tenantId: string, address: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:whatsapp:${address}`},0))`.execute(tx);
}
async function contact(tx: Tx, id: string) {
  const {
    rows: [c],
  } = await sql<{
    id: string;
    facility_id: string;
    patient_id: string | null;
    booking_party_id: string | null;
    channel: 'whatsapp';
    address: string;
    status: 'active' | 'retired';
    version: number;
  }>`SELECT * FROM comms.contact_point WHERE id=${id}`.execute(tx);
  if (!c) throw notFound('contact point');
  return c;
}
export async function contactOwner(db: Kysely<DB>, caller: Caller, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const c = await contact(tx, id);
    return { facilityId: c.facility_id, patientId: c.patient_id, bookingPartyId: c.booking_party_id };
  });
}
export async function requireBookingPartyAtFacility(
  db: Kysely<DB>,
  caller: Caller,
  bookingPartyId: string,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const a = await tx
      .selectFrom('booking.appointment')
      .select('id')
      .where('booking_party_id', '=', bookingPartyId)
      .where('facility_id', '=', facilityId)
      .executeTakeFirst();
    if (!a) {
      const entry = await tx
        .selectFrom('booking.waitlist_entry')
        .select('id')
        .where('booking_party_id', '=', bookingPartyId)
        .where('facility_id', '=', facilityId)
        .executeTakeFirst();
      if (!entry) {
        const {
          rows: [conversation],
        } = await sql<{
          id: string;
        }>`SELECT c.id FROM comms.conversation c JOIN comms.contact_point p ON p.tenant_id=c.tenant_id AND p.id=c.contact_point_id WHERE c.facility_id=${facilityId} AND p.booking_party_id=${bookingPartyId} LIMIT 1`.execute(
          tx,
        );
        if (!conversation) throw notFound('booking contact at this facility');
      }
    }
  });
}
async function contactDto(tx: Tx, id: string, revealAddress = true) {
  const c = await contact(tx, id);
  const {
    rows: [r],
  } = await sql<{
    care: boolean;
    reminders: boolean;
    marketing: boolean;
  }>`SELECT comms.has_consent(${id},'care') AS care,comms.has_consent(${id},'reminders') AS reminders,comms.has_consent(${id},'marketing') AS marketing`.execute(
    tx,
  );
  return ContactPointSchema.parse({
    id: c.id,
    facilityId: c.facility_id,
    patientId: c.patient_id,
    bookingPartyId: c.booking_party_id,
    channel: c.channel,
    address: revealAddress ? c.address : c.address.replace(/.(?=.{4})/g, '•'),
    status: c.status,
    version: c.version,
    interests: (
      await sql<{
        interest: string;
      }>`SELECT interest FROM comms.contact_interest WHERE contact_point_id=${id} ORDER BY interest`.execute(tx)
    ).rows.map((r) => r.interest),
    consents: r,
  });
}
export async function listContacts(
  db: Kysely<DB>,
  caller: Caller,
  filter: { facilityId: string; patientId?: string; bookingPartyId?: string },
  options: { revealAddress: boolean } = { revealAddress: false },
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ id: string }>`SELECT id FROM comms.contact_point WHERE facility_id=${filter.facilityId}
      AND (${filter.patientId ?? null}::uuid IS NULL OR patient_id=${filter.patientId ?? null})
      AND (${filter.bookingPartyId ?? null}::uuid IS NULL OR booking_party_id=${filter.bookingPartyId ?? null}) ORDER BY created_at DESC LIMIT 100`.execute(
      tx,
    );
    return { items: await Promise.all(rows.map((r) => contactDto(tx, r.id, options.revealAddress))) };
  });
}
export async function createContact(db: Kysely<DB>, caller: Caller, input: ContactPointCreate, idempotencyKey: string) {
  return runCommand(
    db,
    { ...caller, module: 'comms', name: 'comms.create_contact', idempotencyKey, request: input },
    async (ctx) => {
      await active(ctx.tx);
      await addressLock(ctx.tx, ctx.tenantId, input.address);
      const facility = await ctx.tx
        .selectFrom('platform.facility')
        .select('id')
        .where('id', '=', input.facilityId)
        .executeTakeFirst();
      if (!facility) throw notFound('facility');
      const owner = input.patientId
        ? await ctx.tx.selectFrom('patient.patient').select('id').where('id', '=', input.patientId).executeTakeFirst()
        : await ctx.tx
            .selectFrom('booking.booking_party')
            .select('id')
            .where('id', '=', input.bookingPartyId!)
            .executeTakeFirst();
      if (!owner) throw notFound('contact owner');
      if (input.bookingPartyId) {
        const appointment = await ctx.tx
          .selectFrom('booking.appointment')
          .select('id')
          .where('booking_party_id', '=', input.bookingPartyId)
          .where('facility_id', '=', input.facilityId)
          .executeTakeFirst();
        if (!appointment) {
          const entry = await ctx.tx
            .selectFrom('booking.waitlist_entry')
            .select('id')
            .where('booking_party_id', '=', input.bookingPartyId)
            .where('facility_id', '=', input.facilityId)
            .executeTakeFirst();
          if (!entry) throw notFound('booking contact at this facility');
        }
      }
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.contact_point(tenant_id,facility_id,patient_id,booking_party_id,channel,address,created_by)
      VALUES(${ctx.tenantId},${input.facilityId},${input.patientId ?? null},${input.bookingPartyId ?? null},'whatsapp',${input.address},${ctx.actor.staffId ?? null})
      ON CONFLICT DO NOTHING RETURNING id`.execute(ctx.tx);
      const id =
        r?.id ??
        (
          await sql<{
            id: string;
          }>`SELECT id FROM comms.contact_point WHERE facility_id=${input.facilityId} AND address=${input.address} AND status='active' AND coalesce(patient_id,booking_party_id)=${input.patientId ?? input.bookingPartyId}`.execute(
            ctx.tx,
          )
        ).rows[0]!.id;
      if (r) {
        ctx.audit({ action: 'create', subjectType: 'comms.contact_point', subjectId: id, patientId: input.patientId });
        ctx.emit({
          eventType: 'contact.created',
          aggregateType: 'comms.contact_point',
          aggregateId: id,
          payload: { contactPointId: id },
        });
      }
      return contactDto(ctx.tx, id);
    },
  );
}
export async function recordMessagingConsent(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: MessagingConsentCreate,
  idempotencyKey: string,
) {
  return runCommand(
    db,
    { ...caller, module: 'comms', name: 'comms.record_consent', idempotencyKey, request: { id, ...input } },
    async (ctx) => {
      const c = await contact(ctx.tx, id);
      await addressLock(ctx.tx, ctx.tenantId, c.address);
      // Withdrawals are intentionally accepted when the optional module is suspended.
      if (input.action === 'opt_in') await active(ctx.tx);
      const {
        rows: [e],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.messaging_consent_event(tenant_id,contact_point_id,purpose,action,source,evidence,explicit_opt_in,recorded_by)
      VALUES(${ctx.tenantId},${id},${input.purpose},${input.action},'staff',${input.evidence},${input.explicitOptIn === true},${ctx.actor.staffId ?? null}) RETURNING id`.execute(
        ctx.tx,
      );
      if (input.action !== 'opt_in') {
        await cancelAddressWork(ctx.tx, ctx.tenantId, c.address, input.action === 'stop' ? 'all' : input.purpose);
        const aliases =
          input.action === 'stop'
            ? sql`SELECT id FROM comms.contact_point WHERE channel='whatsapp' AND address=${c.address}`
            : sql`SELECT ${id}::uuid AS id`;
        await sql`UPDATE comms.reminder_job SET status='cancelled',reason='consent_withdrawn' WHERE contact_point_id IN (${aliases}) AND status IN ('scheduled','queued') AND (${input.action === 'stop'} OR purpose=${input.purpose})`.execute(
          ctx.tx,
        );
        await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE status='queued' AND reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE reason='consent_withdrawn' AND status='cancelled')`.execute(
          ctx.tx,
        );
      }
      ctx.audit({
        action: 'create',
        subjectType: 'comms.messaging_consent_event',
        subjectId: e!.id,
        patientId: c.patient_id,
        diff: { purpose: input.purpose, action: input.action, source: 'staff' },
      });
      ctx.emit({
        eventType: 'messaging.consent_recorded',
        aggregateType: 'comms.contact_point',
        aggregateId: id,
        payload: { contactPointId: id, action: input.action, purpose: input.purpose },
      });
      return contactDto(ctx.tx, id);
    },
  );
}
export async function capabilities(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    CommsCapabilitiesSchema.parse({
      facilityId,
      moduleStatus: await moduleState(tx),
      transport: 'log',
      liveSending: false,
      reason: 'provider_transport_not_implemented',
    }),
  );
}
export async function appointmentFacility(db: Kysely<DB>, caller: Caller, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const a = await tx.selectFrom('booking.appointment').select('facility_id').where('id', '=', id).executeTakeFirst();
    if (!a) throw notFound('appointment');
    return a.facility_id;
  });
}
export async function messages(
  db: Kysely<DB>,
  caller: Caller,
  filter: {
    appointmentId?: string;
    offerId?: string;
    facilityId?: string;
    kind?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  },
) {
  let cursor: { at: string; id: string } | null = null;
  if (filter.cursor) {
    try {
      const raw = JSON.parse(Buffer.from(filter.cursor, 'base64url').toString());
      if (
        typeof raw.at !== 'string' ||
        !Number.isFinite(Date.parse(raw.at)) ||
        typeof raw.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.id)
      )
        throw Error();
      cursor = raw;
    } catch {
      throw invalid('invalid notification cursor');
    }
  }
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      id: string;
      appointment_id: string | null;
      waitlist_offer_id: string | null;
      waitlist_entry_id: string | null;
      kind: string;
      status: string;
      due_at: Date;
      expires_at: Date;
      created_at: Date;
      cursor_at: string;
      version: number;
      reason: string | null;
      message_id: string | null;
      message_status: string | null;
      attempts: number | null;
    }>`
      SELECT j.*,j.created_at::text AS cursor_at,o.waitlist_entry_id,m.id AS message_id,m.status AS message_status,m.attempts FROM comms.reminder_job j
      LEFT JOIN booking.waitlist_offer o ON o.tenant_id=j.tenant_id AND o.id=j.waitlist_offer_id
      LEFT JOIN comms.outbound_message m ON m.tenant_id=j.tenant_id AND m.reminder_job_id=j.id
      WHERE (${filter.appointmentId ?? null}::uuid IS NULL OR j.appointment_id=${filter.appointmentId ?? null})
      AND (${filter.offerId ?? null}::uuid IS NULL OR j.waitlist_offer_id=${filter.offerId ?? null})
      AND (${filter.facilityId ?? null}::uuid IS NULL OR j.facility_id=${filter.facilityId ?? null})
      AND (${filter.kind ?? null}::text IS NULL OR j.kind=${filter.kind ?? null}) AND (${filter.status ?? null}::text IS NULL OR j.status=${filter.status ?? null})
      AND (${filter.from ?? null}::timestamptz IS NULL OR j.created_at>=${filter.from ?? null}::timestamptz)
      AND (${filter.to ?? null}::timestamptz IS NULL OR j.created_at<${filter.to ?? null}::timestamptz)
      AND (${cursor?.at ?? null}::timestamptz IS NULL OR (j.created_at,j.id)<(${cursor?.at ?? null}::timestamptz,${cursor?.id ?? null}::uuid))
      ORDER BY j.created_at DESC,j.id DESC LIMIT ${(filter.limit ?? 100) + 1}`.execute(tx);
    const more = rows.length > (filter.limit ?? 100),
      page = rows.slice(0, filter.limit ?? 100),
      last = page.at(-1);
    return AppointmentMessagesResponseSchema.parse({
      items: page.map((r) => ({
        id: r.id,
        appointmentId: r.appointment_id,
        offerId: r.waitlist_offer_id,
        waitlistEntryId: r.waitlist_entry_id,
        version: r.version,
        createdAt: new Date(r.created_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
        kind: r.kind,
        status: r.status,
        dueAt: new Date(r.due_at).toISOString(),
        reason: r.reason,
        message: r.message_id
          ? { id: r.message_id, status: r.message_status, transport: 'log', attempts: r.attempts }
          : null,
      })),
      nextCursor:
        more && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString('base64url') : null,
    });
  });
}

/** Acquire every affected destination before any job row, in stable order (STOP uses address then job). */
async function lockAppointmentAddresses(tx: Tx, tenantId: string, ids: string[]) {
  const { rows } = await sql<{ address: string }>`
    SELECT DISTINCT c.address FROM comms.contact_point c WHERE
    c.id IN(SELECT contact_point_id FROM comms.reminder_job WHERE appointment_id=ANY(${ids}::uuid[]))
    OR EXISTS(SELECT 1 FROM booking.appointment a WHERE a.id=ANY(${ids}::uuid[]) AND a.facility_id=c.facility_id
      AND ((a.patient_id IS NOT NULL AND a.patient_id=c.patient_id) OR (a.patient_id IS NULL AND a.booking_party_id=c.booking_party_id)))
    ORDER BY c.address`.execute(tx);
  for (const row of rows) await addressLock(tx, tenantId, row.address);
}

async function cancelJobs(tx: Tx, tenantId: string, appointmentId: string, reason: string) {
  await lockAppointmentAddresses(tx, tenantId, [appointmentId]);
  await sql`UPDATE comms.reminder_job SET status='cancelled',reason=${reason} WHERE appointment_id=${appointmentId} AND status IN ('scheduled','queued') AND (${reason !== 'appointment_cancelled'} OR kind <> 'cancellation')`.execute(
    tx,
  );
  await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE status='queued' AND reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE appointment_id=${appointmentId} AND status='cancelled')`.execute(
    tx,
  );
}
async function schedule(
  tx: Tx,
  event: OutboxEvent,
  appointmentId: string,
  kind: 'confirmation' | 'reschedule' | 'cancellation' | 'day_before' | 'same_day' | 'feedback' | 'no_show',
) {
  const a = await tx.selectFrom('booking.appointment').selectAll().where('id', '=', appointmentId).executeTakeFirst();
  if (!a) return;
  const now = new Date();
  const successor = await tx
    .selectFrom('booking.appointment')
    .select('id')
    .where('rescheduled_from_id', '=', a.id)
    .executeTakeFirst();
  if (successor) {
    await cancelJobs(tx, event.tenantId, a.id, 'rescheduled');
    return;
  }
  const terminal = kind === 'feedback' || kind === 'no_show';
  if (a.status !== (kind === 'cancellation' ? 'cancelled' : kind === 'feedback' ? 'completed' : kind === 'no_show' ? 'no_show' : 'confirmed')) return;
  const isReminder = kind === 'day_before' || kind === 'same_day';
  const rule = kind !== 'confirmation' ? await ruleFor(tx, a.facility_id, kind) : null;
  if (rule && !rule.enabled) return;
  const purpose = isReminder || terminal ? 'reminders' : 'care';
  // Routing uses explicit patient/booking-party identity, never a phone-number patient lookup.
  const {
    rows: [c],
  } = await sql<{
    id: string;
    address: string;
  }>`SELECT id,address FROM comms.contact_point WHERE facility_id=${a.facility_id} AND status='active'
    AND ((${a.patient_id}::uuid IS NOT NULL AND patient_id=${a.patient_id}) OR (${a.patient_id}::uuid IS NULL AND booking_party_id=${a.booking_party_id}))
    ORDER BY created_at,id LIMIT 1`.execute(tx);
  if (c) await addressLock(tx, event.tenantId, c.address);
  const allowed = c
    ? (await sql<{ ok: boolean }>`SELECT comms.has_consent(${c.id},${purpose}) AS ok`.execute(tx)).rows[0]!.ok
    : false;
  const starts = a.starts_at ? new Date(a.starts_at) : null;
  const terminalAt = kind === 'feedback' ? a.completed_at : kind === 'no_show' ? (await tx.selectFrom('booking.appointment_status_history').select('occurred_at').where('appointment_id','=',a.id).where('to_status','=','no_show').orderBy('occurred_at','desc').executeTakeFirst())?.occurred_at : null;
  if(terminal&&!terminalAt)return;
  const due = terminal ? new Date(new Date(terminalAt!).getTime() + (rule?.delayHours ?? 24)*3600000) : isReminder && starts ? new Date(starts.getTime() - (rule?.delayHours ?? 24) * 3600000) : now;
  const expires =
    terminal ? new Date(due.getTime()+86400000) : kind === 'cancellation'
      ? new Date(event.occurredAt.getTime() + 86400000)
      : (starts ?? new Date(event.occurredAt.getTime() + 86400000));
  let reason: string | null = null;
  let status = 'scheduled';
  if (!allowed) {
    status = 'skipped_no_consent';
    reason = c ? 'no_consent' : 'no_contact';
  } else if (isReminder && (!starts || due <= now)) {
    status = 'skipped';
    reason = 'reminder_already_due';
  } else if (expires <= now) {
    status = 'skipped';
    reason = 'expired';
  }
  if (kind === 'same_day' && starts) {
    const f = await tx
      .selectFrom('platform.facility')
      .select('timezone')
      .where('id', '=', a.facility_id)
      .executeTakeFirstOrThrow();
    if (new Intl.DateTimeFormat('en-CA', { timeZone: f.timezone }).format(due) !== a.session_on) {
      status = 'skipped';
      reason = 'outside_visit_day';
    }
  }
  const {
    rows: [j],
  } = await sql<{
    id: string;
  }>`INSERT INTO comms.reminder_job(tenant_id,facility_id,appointment_id,contact_point_id,kind,purpose,due_at,expires_at,status,reason,rule_version)
    VALUES(${event.tenantId},${a.facility_id},${a.id},${c?.id ?? null},${kind},${purpose},${due},${expires},${status},${reason},${rule?.version ?? null}) ON CONFLICT(tenant_id,appointment_id,kind) DO NOTHING RETURNING id`.execute(
    tx,
  );
  if (!j) return;
  if (status === 'scheduled')
    await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,reminder_job_id,contact_point_id) VALUES(${event.tenantId},${a.facility_id},${j.id},${c!.id})`.execute(
      tx,
    );
  // Only newly scheduled jobs under an explicitly enabled, provider-approved managed rule can send.
  // Historical log rows are never upgraded by enabling a rule later.
  if(status==='scheduled') await sql`UPDATE comms.outbound_message m SET managed_send_requested=true,managed_purpose='reminder',
    managed_details=jsonb_build_object('automationId',r.id,'automationVersion',r.version,'phoneNumberId',mc.external_id)
    FROM comms.managed_automation r JOIN comms.managed_connection mc ON mc.id=r.connection_id AND mc.tenant_id=r.tenant_id AND mc.enabled AND mc.metadata->>'subscribed'='true'
    WHERE m.reminder_job_id=${j.id} AND r.facility_id=${a.facility_id} AND r.kind=${kind} AND r.enabled AND r.provider_status='approved' AND ${a.created_at}>=r.enabled_at AND ${kind!=='confirmation'||a.origin_channel!=='whatsapp'}`.execute(tx);
  await writeAudit(tx, event.tenantId, { kind: 'system' }, event.correlationId, [
    { action: 'create', subjectType: 'comms.reminder_job', subjectId: j.id, diff: { kind, status, reason } },
  ]);
  await writeOutbox(tx, event.tenantId, event.correlationId, [
    {
      eventType: 'notification.scheduled',
      aggregateType: 'comms.reminder_job',
      aggregateId: j.id,
      payload: { appointmentId: a.id, jobId: j.id, kind, status },
    },
  ]);
}
export async function handleAppointmentNotification(tx: Tx, event: OutboxEvent) {
  const ids =
    event.eventType === 'appointment.rescheduled'
      ? (() => {
          const p = AppointmentRescheduledEventSchema.parse(event.payload);
          return [p.fromAppointmentId, p.toAppointmentId];
        })()
      : [AppointmentNotificationEventSchema.parse(event.payload).appointmentId];
  const facilities = await tx.selectFrom('booking.appointment').select('facility_id').where('id', 'in', ids).execute();
  for (const facility of [...new Set(facilities.map((f) => f.facility_id))].sort())
    for (const kind of Object.keys(RULE_DEFAULTS).sort())
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${event.tenantId}:rule:${facility}:${kind}`},0))`.execute(
        tx,
      );
  await lockAppointmentAddresses(tx, event.tenantId, ids);
  if (event.eventType === 'appointment.rescheduled') {
    const { fromAppointmentId: from } = AppointmentRescheduledEventSchema.parse(event.payload);
    await cancelJobs(tx, event.tenantId, from, 'rescheduled');
  }
  if (event.eventType === 'appointment.cancelled')
    await cancelJobs(
      tx,
      event.tenantId,
      AppointmentNotificationEventSchema.parse(event.payload).appointmentId,
      'appointment_cancelled',
    );
  if ((await moduleState(tx)) !== 'active') return;
  if (event.eventType === 'appointment.rescheduled') {
    const { toAppointmentId: id } = AppointmentRescheduledEventSchema.parse(event.payload);
    await schedule(tx, event, id, 'reschedule');
    await schedule(tx, event, id, 'day_before');
    await schedule(tx, event, id, 'same_day');
  } else if (event.eventType === 'appointment.confirmed') {
    const { appointmentId: id } = AppointmentNotificationEventSchema.parse(event.payload);
    const a = await tx
      .selectFrom('booking.appointment')
      .select('rescheduled_from_id')
      .where('id', '=', id)
      .executeTakeFirst();
    await schedule(tx, event, id, a?.rescheduled_from_id ? 'reschedule' : 'confirmation');
    await schedule(tx, event, id, 'day_before');
    await schedule(tx, event, id, 'same_day');
  } else if (event.eventType === 'appointment.cancelled')
    await schedule(tx, event, AppointmentNotificationEventSchema.parse(event.payload).appointmentId, 'cancellation');
  else if(event.eventType === 'appointment.completed' || event.eventType === 'appointment.no_show')
    await schedule(tx,event,AppointmentNotificationEventSchema.parse(event.payload).appointmentId,event.eventType === 'appointment.completed' ? 'feedback' : 'no_show');
}

/** Revalidate due jobs, then keep valid simulation rows queued. Never send or log a body/contact. */
export async function evaluateDueNotifications(db: Kysely<DB>): Promise<number> {
  const { rows } = await sql<{ tenant_id: string; id: string }>`SELECT * FROM comms.due_notification_jobs(100)`.execute(
    db,
  );
  for (const r of rows)
    await db.transaction().execute(async (tx) => {
      await setTransactionContext(tx, r.tenant_id);
      await sql`SET LOCAL ROLE mod_comms`.execute(tx);
      // Lock address before job to share the same lock order as STOP.
      const {
        rows: [target],
      } = await sql<{
        address: string;
      }>`SELECT c.address FROM comms.reminder_job j JOIN comms.contact_point c ON c.id=j.contact_point_id AND c.tenant_id=j.tenant_id WHERE j.id=${r.id}`.execute(
        tx,
      );
      if (target) await addressLock(tx, r.tenant_id, target.address);
      const {
        rows: [j],
      } = await sql<{
        id: string;
        appointment_id: string | null;
        waitlist_offer_id: string | null;
        rule_version: number | null;
        contact_point_id: string | null;
        purpose: string;
        kind: string;
        expires_at: Date;
        status: string;
      }>`SELECT * FROM comms.reminder_job WHERE id=${r.id} FOR UPDATE`.execute(tx);
      if (!j || !['scheduled', 'queued'].includes(j.status)) return;
      if (j.status === 'queued' && new Date(j.expires_at) > new Date()) return;
      const a = await tx
        .selectFrom('booking.appointment')
        .select(['status', 'starts_at'])
        .where('id', '=', j.appointment_id ?? '00000000-0000-0000-0000-000000000000')
        .executeTakeFirst();
      const successor = await tx
        .selectFrom('booking.appointment')
        .select('id')
        .where('rescheduled_from_id', '=', j.appointment_id ?? '00000000-0000-0000-0000-000000000000')
        .executeTakeFirst();
      const allowed = j.contact_point_id
        ? (await sql<{ ok: boolean }>`SELECT comms.has_consent(${j.contact_point_id},${j.purpose}) AS ok`.execute(tx))
            .rows[0]!.ok
        : false;
      let reason: string | null = null;
      if ((await moduleState(tx)) !== 'active') reason = 'module_inactive';
      else if (!allowed) reason = 'consent_withdrawn';
      else if (successor) reason = 'rescheduled';
      else if (
        j.kind !== 'waitlist_offer' &&
        (!a ||
          (j.kind === 'cancellation'
            ? a.status !== 'cancelled'
            : j.kind === 'follow_up' || j.kind === 'feedback'
              ? a.status !== 'completed'
              : j.kind === 'no_show' ? a.status !== 'no_show'
              : a.status !== 'confirmed'))
      )
        reason = 'appointment_inactive';
      else if (new Date(j.expires_at) <= new Date()) reason = 'expired';
      if (!reason && j.waitlist_offer_id) {
        const {
          rows: [o],
        } = await sql<{
          outcome: string;
          status: string;
          expires_at: Date;
        }>`SELECT o.outcome,e.status,o.expires_at FROM booking.waitlist_offer o JOIN booking.waitlist_entry e ON e.id=o.waitlist_entry_id AND e.tenant_id=o.tenant_id WHERE o.id=${j.waitlist_offer_id}`.execute(
          tx,
        );
        if (!o || o.outcome !== 'pending' || o.status !== 'offered' || new Date(o.expires_at) <= new Date())
          reason = 'offer_inactive';
      }
      if (!reason && j.rule_version !== null) {
        const {
          rows: [scope],
        } = await sql<{ facility_id: string }>`SELECT facility_id FROM comms.reminder_job WHERE id=${j.id}`.execute(tx);
        const rule = await ruleFor(tx, scope!.facility_id, j.kind as RuleKind);
        if (!rule.enabled || rule.version !== j.rule_version) reason = 'rule_changed';
      }
      await sql`UPDATE comms.reminder_job SET status=${reason ? 'cancelled' : 'queued'},reason=${reason ?? 'log_transport_no_delivery'} WHERE id=${j.id}`.execute(
        tx,
      );
      if (reason)
        await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE reminder_job_id=${j.id} AND status='queued'`.execute(
          tx,
        );
      await writeAudit(tx, r.tenant_id, { kind: 'system' }, null, [
        {
          action: 'status_change',
          subjectType: 'comms.reminder_job',
          subjectId: j.id,
          diff: { status: reason ? 'cancelled' : 'queued', reason: reason ?? 'log_transport_no_delivery' },
        },
      ]);
    });
  return rows.length;
}

const RULE_DEFAULTS = {
  day_before: { enabled: true, delayHours: 24 },
  same_day: { enabled: false, delayHours: 2 },
  follow_up: { enabled: false, delayHours: 0 },
  feedback: { enabled: false, delayHours: 24 },
  no_show: { enabled: false, delayHours: 24 },
  reschedule: { enabled: true, delayHours: 0 },
  cancellation: { enabled: true, delayHours: 0 },
};
type RuleKind = keyof typeof RULE_DEFAULTS;
async function ruleFor(tx: Tx, facilityId: string, kind: RuleKind) {
  const {
    rows: [r],
  } = await sql<{
    id: string;
    enabled: boolean;
    delay_hours: number;
    version: number;
  }>`SELECT * FROM comms.followup_rule WHERE facility_id=${facilityId} AND kind=${kind}`.execute(tx);
  return FollowupRuleSchema.parse({
    id: r?.id ?? null,
    facilityId,
    kind,
    enabled: r?.enabled ?? RULE_DEFAULTS[kind].enabled,
    delayHours: r?.delay_hours ?? RULE_DEFAULTS[kind].delayHours,
    version: r?.version ?? 0,
    transport: 'log',
    templateReady: false,
  });
}
export async function followupRules(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    FollowupRulesResponseSchema.parse({
      items: await Promise.all((Object.keys(RULE_DEFAULTS) as RuleKind[]).map((kind) => ruleFor(tx, facilityId, kind))),
    }),
  );
}
export async function upsertFollowupRule(
  db: Kysely<DB>,
  caller: Caller,
  kind: RuleKind,
  input: FollowupRuleUpsert,
  key: string,
) {
  return runCommand(
    db,
    { ...caller, module: 'comms', name: 'comms.upsert_rule', idempotencyKey: key, request: { kind, ...input } },
    async (ctx) => {
      await active(ctx.tx);
      if ((kind === 'reschedule' || kind === 'cancellation') && input.delayHours !== 0) throw invalid('immediate notices require zero delay');
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:rule:${input.facilityId}:${kind}`},0))`.execute(
        ctx.tx,
      );
      const before = await ruleFor(ctx.tx, input.facilityId, kind);
      if (before.version !== input.version)
        throw conflict('rule changed; reload before saving', {
          reason: 'stale_version',
          currentVersion: before.version,
        });
      const { rows: contacts } = await sql<{
        address: string;
      }>`SELECT DISTINCT c.address FROM comms.reminder_job j JOIN comms.contact_point c ON c.tenant_id=j.tenant_id AND c.id=j.contact_point_id WHERE j.facility_id=${input.facilityId} AND j.kind=${kind} ORDER BY c.address`.execute(
        ctx.tx,
      );
      for (const c of contacts) await addressLock(ctx.tx, ctx.tenantId, c.address);
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.followup_rule(tenant_id,facility_id,kind,enabled,delay_hours,created_by) VALUES(${ctx.tenantId},${input.facilityId},${kind},${input.enabled},${input.delayHours},${ctx.actor.staffId ?? null})
    ON CONFLICT(tenant_id,facility_id,kind) DO UPDATE SET enabled=EXCLUDED.enabled,delay_hours=EXCLUDED.delay_hours RETURNING id`.execute(
        ctx.tx,
      );
      await sql`UPDATE comms.reminder_job SET status='cancelled',reason=${input.enabled ? 'rule_changed' : 'rule_disabled'} WHERE facility_id=${input.facilityId} AND kind=${kind} AND status IN('scheduled','queued')`.execute(
        ctx.tx,
      );
      await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE status='queued' AND reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE facility_id=${input.facilityId} AND kind=${kind} AND status='cancelled')`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: 'update',
        subjectType: 'comms.followup_rule',
        subjectId: r!.id,
        diff: { kind, enabled: input.enabled, delayHours: input.delayHours },
      });
      ctx.emit({
        eventType: 'notification.rule_changed',
        aggregateType: 'comms.followup_rule',
        aggregateId: r!.id,
        payload: { facilityId: input.facilityId, kind },
      });
      return ruleFor(ctx.tx, input.facilityId, kind);
    },
  );
}
export async function scheduleFollowup(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: AppointmentFollowupCreate,
  key: string,
) {
  const due = new Date(input.dueAt),
    now = clock(caller);

  await runCommand(
    db,
    { ...caller, module: 'comms', name: 'comms.schedule_followup', idempotencyKey: key, request: { id, ...input } },
    async (ctx) => {
      if (due <= now || due.getTime() > now.getTime() + 365 * 86400000)
        throw invalid('follow-up must be in the future within one year');
      await active(ctx.tx);
      const a = await ctx.tx.selectFrom('booking.appointment').selectAll().where('id', '=', id).executeTakeFirst();
      if (!a) throw notFound('appointment');
      if (a.version !== input.version)
        throw conflict('visit changed; reload before scheduling', { reason: 'stale_version' });
      if (a.status !== 'completed' || !a.completed_at) throw preconditionFailed('follow-up requires a completed visit');
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:rule:${a.facility_id}:follow_up`},0))`.execute(
        ctx.tx,
      );
      const rule = await ruleFor(ctx.tx, a.facility_id, 'follow_up');
      if (!rule.enabled) throw preconditionFailed('enable the local follow-up rule first');
      if (due.getTime() < new Date(a.completed_at).getTime() + rule.delayHours * 3600000)
        throw invalid('follow-up is before the configured completed-visit delay');
      await lockAppointmentAddresses(ctx.tx, ctx.tenantId, [id]);
      const {
        rows: [c],
      } = await sql<{
        id: string;
      }>`SELECT id FROM comms.contact_point WHERE facility_id=${a.facility_id} AND status='active' AND ((${a.patient_id}::uuid IS NOT NULL AND patient_id=${a.patient_id}) OR (${a.patient_id}::uuid IS NULL AND booking_party_id=${a.booking_party_id})) ORDER BY created_at,id LIMIT 1`.execute(
        ctx.tx,
      );
      const allowed = c
        ? (await sql<{ ok: boolean }>`SELECT comms.has_consent(${c.id},'reminders') AS ok`.execute(ctx.tx)).rows[0]!.ok
        : false;
      const {
        rows: [j],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.reminder_job(tenant_id,facility_id,appointment_id,contact_point_id,kind,purpose,due_at,expires_at,status,reason,rule_version)
   VALUES(${ctx.tenantId},${a.facility_id},${id},${c?.id ?? null},'follow_up','reminders',${due},${new Date(due.getTime() + 86400000)},${allowed ? 'scheduled' : 'skipped_no_consent'},${allowed ? null : c ? 'no_consent' : 'no_contact'},${rule.version}) ON CONFLICT(tenant_id,appointment_id,kind) DO NOTHING RETURNING id`.execute(
        ctx.tx,
      );
      if (!j) throw conflict('this visit already has a follow-up notification', { reason: 'already_scheduled' });
      if (allowed)
        await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,reminder_job_id,contact_point_id) VALUES(${ctx.tenantId},${a.facility_id},${j.id},${c!.id})`.execute(
          ctx.tx,
        );
      ctx.audit({
        action: 'create',
        subjectType: 'comms.reminder_job',
        subjectId: j.id,
        patientId: a.patient_id,
        diff: { kind: 'follow_up', dueAt: input.dueAt },
      });
      ctx.emit({
        eventType: 'notification.scheduled',
        aggregateType: 'comms.reminder_job',
        aggregateId: j.id,
        payload: { appointmentId: id, jobId: j.id, kind: 'follow_up' },
      });
      return { jobId: j.id };
    },
  );
  return NotificationJobSchema.parse((await messages(db, caller, { appointmentId: id, kind: 'follow_up' })).items[0]);
}
export async function offerFacility(db: Kysely<DB>, caller: Caller, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const {
      rows: [r],
    } = await sql<{
      facility_id: string;
    }>`SELECT e.facility_id FROM booking.waitlist_offer o JOIN booking.waitlist_entry e ON e.tenant_id=o.tenant_id AND e.id=o.waitlist_entry_id WHERE o.id=${id}`.execute(
      tx,
    );
    if (!r) throw notFound('waitlist offer');
    return r.facility_id;
  });
}
export async function handleWaitlistNotification(tx: Tx, event: OutboxEvent) {
  const offerId =
    typeof event.payload['offerId'] === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.payload['offerId'])
      ? event.payload['offerId']
      : null;
  if (!offerId) throw invalid('waitlist event requires offerId');
  const {
    rows: [o],
  } = await sql<{
    id: string;
    facility_id: string;
    booking_party_id: string;
    patient_id: string | null;
    outcome: string;
    status: string;
    expires_at: Date;
  }>`SELECT o.id,e.facility_id,e.booking_party_id,b.patient_id,o.outcome,e.status,o.expires_at FROM booking.waitlist_offer o JOIN booking.waitlist_entry e ON e.tenant_id=o.tenant_id AND e.id=o.waitlist_entry_id JOIN booking.booking_party b ON b.tenant_id=e.tenant_id AND b.id=e.booking_party_id WHERE o.id=${offerId}`.execute(
    tx,
  );
  if (!o) return;
  const { rows: contacts } = await sql<{
    id: string;
    address: string;
  }>`SELECT c.id,c.address FROM comms.contact_point c WHERE c.facility_id=${o.facility_id} AND c.status='active' AND c.booking_party_id=${o.booking_party_id} ORDER BY c.address,c.created_at,c.id`.execute(
    tx,
  );
  for (const c of contacts) await addressLock(tx, event.tenantId, c.address);
  const c = contacts[0];
  if (
    event.eventType === 'waitlist.offer_closed' ||
    o.outcome !== 'pending' ||
    o.status !== 'offered' ||
    new Date(o.expires_at) <= new Date()
  ) {
    await sql`UPDATE comms.reminder_job SET status='cancelled',reason='offer_inactive' WHERE waitlist_offer_id=${offerId} AND status IN('scheduled','queued')`.execute(
      tx,
    );
    await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE status='queued' AND reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE waitlist_offer_id=${offerId} AND status='cancelled')`.execute(
      tx,
    );
    return;
  }
  if ((await moduleState(tx)) !== 'active') return;
  const allowed = c
    ? (await sql<{ ok: boolean }>`SELECT comms.has_consent(${c.id},'care') AS ok`.execute(tx)).rows[0]!.ok
    : false;
  const {
    rows: [j],
  } = await sql<{
    id: string;
  }>`INSERT INTO comms.reminder_job(tenant_id,facility_id,waitlist_offer_id,contact_point_id,kind,purpose,due_at,expires_at,status,reason) VALUES(${event.tenantId},${o.facility_id},${offerId},${c?.id ?? null},'waitlist_offer','care',now(),${o.expires_at},${allowed ? 'scheduled' : 'skipped_no_consent'},${allowed ? null : c ? 'no_consent' : 'no_contact'}) ON CONFLICT(tenant_id,waitlist_offer_id) DO NOTHING RETURNING id`.execute(
    tx,
  );
  if (!j) return;
  if (allowed)
    await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,reminder_job_id,contact_point_id) VALUES(${event.tenantId},${o.facility_id},${j.id},${c!.id})`.execute(
      tx,
    );
  await writeAudit(tx, event.tenantId, { kind: 'system' }, event.correlationId, [
    {
      action: 'create',
      subjectType: 'comms.reminder_job',
      subjectId: j.id,
      diff: { kind: 'waitlist_offer', status: allowed ? 'scheduled' : 'skipped_no_consent' },
    },
  ]);
  await writeOutbox(tx, event.tenantId, event.correlationId, [
    {
      eventType: 'notification.scheduled',
      aggregateType: 'comms.reminder_job',
      aggregateId: j.id,
      payload: { offerId, jobId: j.id },
    },
  ]);
}
