// Clinical notes. Every save is a new immutable version. Drafts are edited by their author; signing
// freezes the note; later changes are amendments with a reason. Signing needs a valid council registration.
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess, ensureEncounterAccess, lockEncounter } from './access.ts';

type NoteType = 'consultation' | 'history' | 'examination' | 'progress' | 'nursing' | 'procedure' | 'discharge_summary' | 'referral_letter';

interface TemplateSchema {
  properties?: Record<string, { type?: string }>;
  additionalProperties?: boolean;
}

/** Checks `data` against the template's top-level properties (types and unknown keys). */
function validateAgainstTemplate(schema: TemplateSchema, data: Record<string, unknown>): void {
  const props = schema.properties ?? {};
  const problems: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const spec = props[key];
    if (!spec) {
      if (schema.additionalProperties === false) problems.push(`${key}: not a field of this template`);
      continue;
    }
    if (value === null) continue;
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (spec.type && spec.type !== actual && !(spec.type === 'integer' && Number.isInteger(value))) problems.push(`${key}: expected ${spec.type}`);
  }
  if (problems.length) throw invalid('note data does not match the template', { issues: problems });
}

async function resolveTemplate(tx: Transaction<DB>, code: string | undefined) {
  if (!code) return null;
  const t = await tx
    .selectFrom('clinical.form_template')
    .select(['id', 'schema', 'note_type'])
    .where('code', '=', code)
    .where('status', '=', 'published')
    .orderBy('tenant_id', (ob) => ob.desc().nullsLast()) // a tenant's own template wins over the system one
    .orderBy('template_version', 'desc')
    .executeTakeFirst();
  if (!t) throw notFound('note template', { code });
  return t;
}

export interface CreateNoteInput {
  encounterId: string;
  noteType: NoteType;
  templateCode?: string;
  data?: Record<string, unknown>;
  narrative?: string;
}

export async function createNote(db: Kysely<DB>, caller: Caller, input: CreateNoteInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.create_note', idempotencyKey, request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    if (enc.status !== 'arrived' && enc.status !== 'in_progress') throw preconditionFailed(`notes can't be started on a ${enc.status} encounter`);
    await ensureEncounterAccess(ctx, enc, now);
    const template = await resolveTemplate(ctx.tx, input.templateCode);
    const data = input.data ?? {};
    if (template) validateAgainstTemplate(template.schema as TemplateSchema, data);
    const { id } = await ctx.tx
      .insertInto('clinical.clinical_note')
      .values({ tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, note_type: input.noteType, author_staff_id: ctx.actor.staffId!, current_version: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('clinical.clinical_note_version')
      .values({ tenant_id: ctx.tenantId, note_id: id, version_no: 1, form_template_id: template?.id ?? null, data: JSON.stringify(data), narrative: input.narrative ?? null, created_by: ctx.actor.staffId! })
      .execute();
    ctx.audit({ action: 'create', subjectType: 'clinical.clinical_note', subjectId: id, patientId: enc.patient_id });
    return { noteId: id, status: 'draft', currentVersion: 1 };
  });
}

export interface SaveNoteInput {
  noteId: string;
  /** The version the client edited; a stale value means someone else saved in between (409). */
  baseVersion: number;
  data?: Record<string, unknown>;
  narrative?: string;
  /** Required when the note is already signed (this makes the save an amendment). */
  amendmentReason?: string;
}

export async function saveNote(db: Kysely<DB>, caller: Caller, input: SaveNoteInput) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.save_note', request: input }, async (ctx) => {
    const note = await ctx.tx.selectFrom('clinical.clinical_note').selectAll().where('id', '=', input.noteId).forUpdate().executeTakeFirst();
    if (!note) throw notFound('note', { noteId: input.noteId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, note.patient_id, now);
    if (note.status === 'entered_in_error') throw preconditionFailed('note was marked entered in error');
    if (note.current_version !== input.baseVersion) throw conflict('the note changed since you opened it; reload and reapply your edit', { currentVersion: note.current_version });
    const signed = note.status === 'signed' || note.status === 'amended';
    if (!signed && note.author_staff_id !== ctx.actor.staffId) throw forbidden('only the author can edit a draft note');
    if (signed && !input.amendmentReason?.trim()) throw preconditionFailed('the note is signed; changing it is an amendment and needs amendmentReason', { reason: 'amendment_reason_required' });

    const prev = await ctx.tx
      .selectFrom('clinical.clinical_note_version')
      .select(['form_template_id', 'data', 'narrative'])
      .where('note_id', '=', note.id)
      .where('version_no', '=', note.current_version)
      .executeTakeFirstOrThrow();
    const data = input.data ?? (prev.data as Record<string, unknown>);
    if (prev.form_template_id) {
      const t = await ctx.tx.selectFrom('clinical.form_template').select('schema').where('id', '=', prev.form_template_id).executeTakeFirstOrThrow();
      validateAgainstTemplate(t.schema as TemplateSchema, data);
    }
    const versionNo = note.current_version + 1;
    await ctx.tx
      .insertInto('clinical.clinical_note_version')
      .values({
        tenant_id: ctx.tenantId,
        note_id: note.id,
        version_no: versionNo,
        form_template_id: prev.form_template_id,
        data: JSON.stringify(data),
        narrative: input.narrative ?? prev.narrative,
        amendment_reason: signed ? input.amendmentReason!.trim() : null,
        created_by: ctx.actor.staffId!,
      })
      .execute();
    await ctx.tx
      .updateTable('clinical.clinical_note')
      .set({ current_version: versionNo, ...(signed ? { status: 'amended' } : {}) })
      .where('id', '=', note.id)
      .execute();
    ctx.audit({ action: 'update', subjectType: 'clinical.clinical_note', subjectId: note.id, patientId: note.patient_id, reason: signed ? input.amendmentReason : undefined });
    return { noteId: note.id, status: signed ? 'amended' : 'draft', currentVersion: versionNo };
  });
}

export async function signNote(db: Kysely<DB>, caller: Caller, input: { noteId: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.sign_note', request: input }, async (ctx) => {
    const note = await ctx.tx.selectFrom('clinical.clinical_note').selectAll().where('id', '=', input.noteId).forUpdate().executeTakeFirst();
    if (!note) throw notFound('note', { noteId: input.noteId });
    if (note.status !== 'draft') throw preconditionFailed(`a ${note.status} note cannot be signed`);
    if (note.author_staff_id !== ctx.actor.staffId) throw forbidden('only the author can sign this note');
    const today = now.toISOString().slice(0, 10);
    const registration = await ctx.tx
      .selectFrom('platform.staff_registration')
      .select('id')
      .where('staff_id', '=', ctx.actor.staffId!)
      .where((eb) => eb.or([eb('valid_until', 'is', null), eb('valid_until', '>=', today)]))
      .executeTakeFirst();
    if (!registration) throw preconditionFailed('signing needs a current professional registration on your staff record', { reason: 'registration_required' });
    await ctx.tx.updateTable('clinical.clinical_note').set({ status: 'signed', signed_at: now, signed_by: ctx.actor.staffId! }).where('id', '=', note.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.clinical_note', subjectId: note.id, patientId: note.patient_id, reason: 'signed' });
    ctx.emit({ eventType: 'note.signed', aggregateType: 'clinical.clinical_note', aggregateId: note.id, payload: { noteId: note.id, encounterId: note.encounter_id, noteType: note.note_type } });
    return { noteId: note.id, status: 'signed', signedAt: now };
  });
}

export async function voidNote(db: Kysely<DB>, caller: Caller, input: { noteId: string; reason: string }) {
  if (input.reason.trim().length < 3) throw invalid('a reason is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.void_note', request: input }, async (ctx) => {
    const note = await ctx.tx.selectFrom('clinical.clinical_note').selectAll().where('id', '=', input.noteId).forUpdate().executeTakeFirst();
    if (!note) throw notFound('note', { noteId: input.noteId });
    if (note.status === 'entered_in_error') return { noteId: note.id, status: 'entered_in_error' };
    if (note.author_staff_id !== ctx.actor.staffId) await assertChartAccess(ctx.tx, ctx.actor.staffId, note.patient_id, now);
    await ctx.tx.updateTable('clinical.clinical_note').set({ status: 'entered_in_error', status_reason: input.reason }).where('id', '=', note.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.clinical_note', subjectId: note.id, patientId: note.patient_id, reason: input.reason });
    return { noteId: note.id, status: 'entered_in_error' };
  });
}

