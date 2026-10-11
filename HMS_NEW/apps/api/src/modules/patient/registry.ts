// The rest of the patient registry (ERD m02, G24): identifiers, related people, clinical consents, flags,
// and duplicate handling. Merges link, never delete: the merged record points at its survivor and every
// read resolves to it; a merge and an unmerge each need two different people (maker-checker).
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, DomainError, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, hospitalDay, type Caller } from '../../caller.ts';

const actor = (ctx: { actor: { staffId?: string | undefined } }) => ctx.actor.staffId ?? null;

async function livePatient(tx: Transaction<DB>, patientId: string) {
  const p = await tx.selectFrom('patient.patient').select(['id', 'status', 'merged_into_patient_id']).where('id', '=', patientId).forUpdate().executeTakeFirst();
  if (!p) throw notFound('patient', { patientId });
  if (p.status === 'merged') throw preconditionFailed('this record was merged; use the surviving record', { reason: 'merged', mergedIntoPatientId: p.merged_into_patient_id });
  return p;
}

/** The patient a (possibly merged) id resolves to, following merge links. */
export async function survivorOf(tx: Transaction<DB>, patientId: string): Promise<string> {
  const { rows: [r] } = await sql<{ id: string }>`
    WITH RECURSIVE chain AS (
      SELECT id, merged_into_patient_id, 0 AS depth FROM patient.patient WHERE id = ${patientId}
      UNION ALL
      SELECT p.id, p.merged_into_patient_id, c.depth + 1 FROM patient.patient p JOIN chain c ON p.id = c.merged_into_patient_id WHERE c.depth < 10
    )
    SELECT id FROM chain WHERE merged_into_patient_id IS NULL LIMIT 1`.execute(tx);
  return r?.id ?? patientId;
}

/** The survivor and every record merged into it, so a chart shows the whole history. */
export async function mergedFamily(tx: Transaction<DB>, survivorId: string): Promise<string[]> {
  const { rows } = await sql<{ id: string }>`
    WITH RECURSIVE fam AS (
      SELECT id FROM patient.patient WHERE id = ${survivorId}
      UNION
      SELECT p.id FROM patient.patient p JOIN fam f ON p.merged_into_patient_id = f.id
    )
    SELECT id FROM fam`.execute(tx);
  return rows.map((r) => r.id);
}

// ---- identifiers ---------------------------------------------------------------------------------------

export type IdentifierSystem = 'abha_number' | 'abha_address' | 'pan' | 'passport' | 'voter_id' | 'driving_licence' | 'insurer_member_no' | 'scheme_id' | 'other';

export async function addIdentifier(
  db: Kysely<DB>,
  caller: Caller,
  input: { patientId: string; system: IdentifierSystem; value: string; issuer?: string | null | undefined; verifiedVia?: 'document' | 'staff' | undefined; isPrimary?: boolean | undefined },
  idempotencyKey: string,
) {
  const value = input.system === 'abha_number' ? input.value.replaceAll('-', '') : input.system === 'pan' ? input.value.toUpperCase() : input.value.trim();
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.add_identifier', idempotencyKey, request: input }, async (ctx) => {
    await livePatient(ctx.tx, input.patientId);
    if (input.isPrimary) {
      await ctx.tx.updateTable('patient.patient_identifier').set({ is_primary: false, updated_by: actor(ctx) }).where('patient_id', '=', input.patientId).where('system', '=', input.system).where('removed_at', 'is', null).execute();
    }
    try {
      const { id } = await ctx.tx
        .insertInto('patient.patient_identifier')
        .values({
          tenant_id: ctx.tenantId,
          patient_id: input.patientId,
          system: input.system,
          value,
          issuer: input.issuer ?? null,
          is_primary: input.isPrimary ?? false,
          verified_at: input.verifiedVia ? clock(caller) : null,
          verified_via: input.verifiedVia ?? null,
          created_by: actor(ctx),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'patient.patient_identifier', subjectId: id, patientId: input.patientId, diff: { system: input.system, verified: !!input.verifiedVia } });
      return { identifierId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('this identifier is already recorded for a patient', { reason: 'duplicate_identifier' });
      if (pgCode(err) === '23514') throw invalid('the identifier is not in the right format for its type', { reason: 'bad_format' });
      throw err;
    }
  });
}

/** Removing an identifier retires it: it stops counting (and its value may be registered again), the row stays. */
export async function removeIdentifier(db: Kysely<DB>, caller: Caller, input: { identifierId: string; reason: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.remove_identifier' }, async (ctx) => {
    const i = await ctx.tx
      .selectFrom('patient.patient_identifier')
      .select(['id', 'patient_id', 'system'])
      .where('id', '=', input.identifierId)
      .where('removed_at', 'is', null)
      .executeTakeFirst();
    if (!i) throw notFound('identifier', { identifierId: input.identifierId });
    await livePatient(ctx.tx, i.patient_id);
    await ctx.tx
      .updateTable('patient.patient_identifier')
      .set({ removed_at: clock(caller), removed_by: actor(ctx), removed_reason: input.reason, is_primary: false, updated_by: actor(ctx) })
      .where('id', '=', i.id)
      .execute();
    ctx.audit({ action: 'update', subjectType: 'patient.patient_identifier', subjectId: i.id, patientId: i.patient_id, reason: input.reason, diff: { removed: i.system } });
    return { identifierId: i.id, removed: true };
  });
}

// ---- related people ------------------------------------------------------------------------------------

export interface RelatedPersonInput {
  name: string;
  relationship: 'spouse' | 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild' | 'guardian' | 'relative' | 'friend' | 'other';
  phone: string | null;
  isGuardian: boolean;
  isEmergencyContact: boolean;
  isLegalRepresentative: boolean;
  representativeScope: string | null;
  relatedPatientId: string | null;
}

const relatedColumns = (i: Partial<RelatedPersonInput>) =>
  Object.fromEntries(
    Object.entries({
      name: i.name,
      relationship: i.relationship,
      phone: i.phone,
      is_guardian: i.isGuardian,
      is_emergency_contact: i.isEmergencyContact,
      is_legal_representative: i.isLegalRepresentative,
      representative_scope: i.representativeScope,
      related_patient_id: i.relatedPatientId,
    }).filter(([, v]) => v !== undefined),
  );

export async function addRelatedPerson(db: Kysely<DB>, caller: Caller, input: RelatedPersonInput & { patientId: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.add_related_person', idempotencyKey, request: input }, async (ctx) => {
    await livePatient(ctx.tx, input.patientId);
    try {
      const { id } = await ctx.tx
        .insertInto('patient.related_person')
        .values({ tenant_id: ctx.tenantId, patient_id: input.patientId, ...(relatedColumns(input) as { name: string; relationship: string }), created_by: actor(ctx) })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'patient.related_person', subjectId: id, patientId: input.patientId, diff: { relationship: input.relationship, guardian: input.isGuardian } });
      return { relatedPersonId: id };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('check the phone number and that the relative is not the patient themselves');
      if (pgCode(err) === '23503') throw notFound('related patient', { relatedPatientId: input.relatedPatientId });
      throw err;
    }
  });
}

export async function updateRelatedPerson(
  db: Kysely<DB>,
  caller: Caller,
  input: Partial<RelatedPersonInput> & { relatedPersonId: string; version: number; ended?: boolean | undefined },
) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.update_related_person' }, async (ctx) => {
    const r = await ctx.tx.selectFrom('patient.related_person').selectAll().where('id', '=', input.relatedPersonId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('related person', { relatedPersonId: input.relatedPersonId });
    if (r.version !== input.version) throw conflict('this record was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
    await livePatient(ctx.tx, r.patient_id);
    const set: Record<string, unknown> = relatedColumns(input);
    if (input.ended) set.valid_to = hospitalDay(clock(caller));
    if (!Object.keys(set).length) return { relatedPersonId: r.id, version: r.version };
    const { version } = await ctx.tx.updateTable('patient.related_person').set({ ...set, updated_by: actor(ctx) }).where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'patient.related_person', subjectId: r.id, patientId: r.patient_id, diff: { fields: Object.keys(set) } });
    return { relatedPersonId: r.id, version };
  });
}

// ---- clinical consents (messaging opt-in is M13, ABDM consent artefacts M17) -----------------------------

export type ConsentType = 'treatment' | 'admission' | 'procedure' | 'anaesthesia' | 'blood_transfusion' | 'high_risk' | 'teleconsult' | 'data_sharing_abdm' | 'research' | 'lama_dama';

export async function recordConsent(
  db: Kysely<DB>,
  caller: Caller,
  input: {
    patientId: string;
    consentType: ConsentType;
    status: 'signed' | 'refused';
    signedBy: 'patient' | 'guardian' | 'representative';
    relatedPersonId?: string | null | undefined;
    encounterId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    language?: string | null | undefined;
    notes?: string | null | undefined;
  },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.record_consent', idempotencyKey, request: input }, async (ctx) => {
    await livePatient(ctx.tx, input.patientId);
    if (input.signedBy !== 'patient' && !input.relatedPersonId) throw invalid('a consent signed by someone else names the related person', { reason: 'signer_required' });
    if (input.relatedPersonId) {
      const rp = await ctx.tx.selectFrom('patient.related_person').select(['is_guardian', 'is_legal_representative', 'valid_to']).where('id', '=', input.relatedPersonId).where('patient_id', '=', input.patientId).executeTakeFirst();
      if (!rp || rp.valid_to) throw invalid('choose a current related person of this patient', { reason: 'signer_not_related' });
      if (input.signedBy === 'guardian' && !rp.is_guardian) throw invalid('that person is not recorded as a guardian', { reason: 'not_guardian' });
      if (input.signedBy === 'representative' && !rp.is_legal_representative) throw invalid('that person is not recorded as a legal representative', { reason: 'not_representative' });
    }
    const { id } = await ctx.tx
      .insertInto('patient.patient_consent')
      .values({
        tenant_id: ctx.tenantId,
        patient_id: input.patientId,
        consent_type: input.consentType,
        status: input.status,
        signed_by: input.signedBy,
        related_person_id: input.relatedPersonId ?? null,
        witness_staff_id: actor(ctx),
        signed_at: clock(caller),
        expires_at: input.expiresAt ?? null,
        encounter_id: input.encounterId ?? null,
        language: input.language ?? null,
        notes: input.notes ?? null,
        created_by: actor(ctx),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'patient.patient_consent', subjectId: id, patientId: input.patientId, diff: { consentType: input.consentType, status: input.status, signedBy: input.signedBy } });
    ctx.emit({ eventType: 'consent.recorded', aggregateType: 'patient.patient_consent', aggregateId: id, payload: { patientId: input.patientId, consentType: input.consentType, status: input.status } });
    return { consentId: id };
  });
}

export async function withdrawConsent(db: Kysely<DB>, caller: Caller, input: { consentId: string; reason: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.withdraw_consent' }, async (ctx) => {
    const c = await ctx.tx.selectFrom('patient.patient_consent').selectAll().where('id', '=', input.consentId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('consent', { consentId: input.consentId });
    if (c.status !== 'signed') throw preconditionFailed(`a ${c.status} consent can't be withdrawn`);
    const now = clock(caller);
    await ctx.tx.updateTable('patient.patient_consent').set({ status: 'withdrawn', withdrawn_at: now, notes: input.reason, updated_by: actor(ctx) }).where('id', '=', c.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'patient.patient_consent', subjectId: c.id, patientId: c.patient_id, reason: input.reason, diff: { status: ['signed', 'withdrawn'] } });
    ctx.emit({ eventType: 'consent.withdrawn', aggregateType: 'patient.patient_consent', aggregateId: c.id, payload: { patientId: c.patient_id, consentType: c.consent_type } });
    return { consentId: c.id, status: 'withdrawn' };
  });
}

// ---- flags ---------------------------------------------------------------------------------------------

export type FlagType = 'isolation' | 'fall_risk' | 'allergy_alert' | 'safeguarding' | 'vip' | 'confidential' | 'mlc' | 'do_not_resuscitate';

export async function setFlag(db: Kysely<DB>, caller: Caller, input: { patientId: string; flagType: FlagType; reason: string; activeTo?: string | null | undefined }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.set_flag', idempotencyKey, request: input }, async (ctx) => {
    await livePatient(ctx.tx, input.patientId);
    const now = clock(caller);
    const open = await ctx.tx
      .selectFrom('patient.patient_flag')
      .select('id')
      .where('patient_id', '=', input.patientId)
      .where('flag_type', '=', input.flagType)
      .where((eb) => eb.or([eb('active_to', 'is', null), eb('active_to', '>', now)]))
      .executeTakeFirst();
    if (open) throw conflict('this flag is already set', { reason: 'already_set', flagId: open.id });
    if (input.activeTo && new Date(input.activeTo) <= now) throw invalid('the flag must end in the future');
    const { id } = await ctx.tx
      .insertInto('patient.patient_flag')
      .values({ tenant_id: ctx.tenantId, patient_id: input.patientId, flag_type: input.flagType, active_from: now, active_to: input.activeTo ?? null, set_by: ctx.actor.staffId!, reason: input.reason, created_by: actor(ctx) })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'patient.patient_flag', subjectId: id, patientId: input.patientId, reason: input.reason, diff: { flagType: input.flagType } });
    ctx.emit({ eventType: 'patient.flag_set', aggregateType: 'patient.patient_flag', aggregateId: id, payload: { patientId: input.patientId, flagType: input.flagType } });
    return { flagId: id };
  });
}

export async function clearFlag(db: Kysely<DB>, caller: Caller, input: { flagId: string; reason: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.clear_flag' }, async (ctx) => {
    const f = await ctx.tx.selectFrom('patient.patient_flag').selectAll().where('id', '=', input.flagId).forUpdate().executeTakeFirst();
    if (!f) throw notFound('flag', { flagId: input.flagId });
    const now = clock(caller);
    if (f.cleared_by || (f.active_to && f.active_to <= now)) throw preconditionFailed('this flag is no longer active');
    await ctx.tx.updateTable('patient.patient_flag').set({ active_to: now, cleared_by: ctx.actor.staffId!, reason: `${f.reason ?? ''}\nCleared: ${input.reason}`.trim(), updated_by: actor(ctx) }).where('id', '=', f.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'patient.patient_flag', subjectId: f.id, patientId: f.patient_id, reason: input.reason, diff: { flagType: f.flag_type, cleared: true } });
    return { flagId: f.id, clearedAt: now };
  });
}

// ---- duplicates, merge, unmerge ------------------------------------------------------------------------

export interface PatientLinkView {
  linkId: string;
  survivorPatientId: string;
  survivorMrn: string;
  otherPatientId: string;
  otherMrn: string;
  linkType: string;
  decidedBy: string | null;
  decidedByName: string | null;
  secondReviewerId: string | null;
  reason: string | null;
  decidedAt: string;
}

export async function listLinks(db: Kysely<DB>, caller: Caller, f: { patientId?: string | undefined; open?: boolean | undefined }): Promise<PatientLinkView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<PatientLinkView>`
      SELECT l.id AS "linkId", l.survivor_patient_id AS "survivorPatientId", s.mrn AS "survivorMrn", l.other_patient_id AS "otherPatientId",
             o.mrn AS "otherMrn", l.link_type AS "linkType", l.decided_by AS "decidedBy", d.display_name AS "decidedByName",
             l.second_reviewer_id AS "secondReviewerId", l.reason, l.decided_at AS "decidedAt"
      FROM patient.patient_link l
      JOIN patient.patient s ON s.id = l.survivor_patient_id
      JOIN patient.patient o ON o.id = l.other_patient_id
      LEFT JOIN platform.staff d ON d.id = l.decided_by
      WHERE (${f.patientId ?? null}::uuid IS NULL OR ${f.patientId ?? null}::uuid IN (l.survivor_patient_id, l.other_patient_id))
        AND (NOT ${!!f.open}::boolean OR l.link_type = 'possible_duplicate')
      ORDER BY l.decided_at DESC
      LIMIT 200`.execute(tx);
    return rows;
  });
}

/** First person: suggests two records are the same patient. Nothing changes until a second person merges. */
export async function proposeDuplicate(db: Kysely<DB>, caller: Caller, input: { survivorPatientId: string; otherPatientId: string; reason: string }, idempotencyKey: string) {
  if (input.survivorPatientId === input.otherPatientId) throw invalid('choose two different records');
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.propose_duplicate', idempotencyKey, request: input }, async (ctx) => {
    await livePatient(ctx.tx, input.survivorPatientId);
    await livePatient(ctx.tx, input.otherPatientId);
    const open = await ctx.tx
      .selectFrom('patient.patient_link')
      .select('id')
      .where('link_type', '=', 'possible_duplicate')
      .where((eb) =>
        eb.or([
          eb.and([eb('survivor_patient_id', '=', input.survivorPatientId), eb('other_patient_id', '=', input.otherPatientId)]),
          eb.and([eb('survivor_patient_id', '=', input.otherPatientId), eb('other_patient_id', '=', input.survivorPatientId)]),
        ]),
      )
      .executeTakeFirst();
    if (open) throw conflict('these records are already proposed as duplicates', { reason: 'already_proposed', linkId: open.id });
    const { id } = await ctx.tx
      .insertInto('patient.patient_link')
      .values({ tenant_id: ctx.tenantId, survivor_patient_id: input.survivorPatientId, other_patient_id: input.otherPatientId, link_type: 'possible_duplicate', decided_by: actor(ctx), reason: input.reason, decided_at: clock(caller), created_by: actor(ctx) })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'patient.patient_link', subjectId: id, patientId: input.survivorPatientId, reason: input.reason, diff: { otherPatientId: input.otherPatientId, linkType: 'possible_duplicate' } });
    return { linkId: id };
  });
}

/**
 * Second person decides a proposal: `merge` makes the other record point at the survivor (it disappears
 * from search, its history shows on the survivor's chart), `not_duplicate` closes it.
 */
export async function decideDuplicate(db: Kysely<DB>, caller: Caller, input: { linkId: string; decision: 'merge' | 'not_duplicate'; reason: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.decide_duplicate' }, async (ctx) => {
    const l = await ctx.tx.selectFrom('patient.patient_link').selectAll().where('id', '=', input.linkId).forUpdate().executeTakeFirst();
    if (!l) throw notFound('duplicate proposal', { linkId: input.linkId });
    if (l.link_type !== 'possible_duplicate') throw conflict('this proposal was already decided', { reason: 'already_decided' });
    if (l.decided_by === ctx.actor.staffId) throw new DomainError('forbidden', 'a second person must decide a merge you proposed', { reason: 'same_person' });
    const now = clock(caller);
    if (input.decision === 'merge') {
      await livePatient(ctx.tx, l.survivor_patient_id);
      await livePatient(ctx.tx, l.other_patient_id);
      await ctx.tx.updateTable('patient.patient').set({ status: 'merged', merged_into_patient_id: l.survivor_patient_id, updated_by: actor(ctx) }).where('id', '=', l.other_patient_id).execute();
      // A survivor that was itself merged into this record would make a cycle; refused above (both live).
    }
    await ctx.tx
      .updateTable('patient.patient_link')
      .set({ link_type: input.decision === 'merge' ? 'merged' : 'not_duplicate', second_reviewer_id: actor(ctx), reason: `${l.reason ?? ''}\n${input.reason}`.trim(), decided_at: now, updated_by: actor(ctx) })
      .where('id', '=', l.id)
      .execute();
    ctx.audit({ action: 'status_change', subjectType: 'patient.patient_link', subjectId: l.id, patientId: l.survivor_patient_id, reason: input.reason, diff: { decision: input.decision, otherPatientId: l.other_patient_id } });
    if (input.decision === 'merge') {
      ctx.emit({ eventType: 'patient.merged', aggregateType: 'patient.patient', aggregateId: l.other_patient_id, payload: { survivorPatientId: l.survivor_patient_id, mergedPatientId: l.other_patient_id } });
    }
    return { linkId: l.id, decision: input.decision };
  });
}

/** Reverses a merge (proposed by one person, confirmed in the same command by a second, as for a merge). */
export async function unmerge(db: Kysely<DB>, caller: Caller, input: { linkId: string; reason: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.unmerge' }, async (ctx) => {
    const l = await ctx.tx.selectFrom('patient.patient_link').selectAll().where('id', '=', input.linkId).forUpdate().executeTakeFirst();
    if (!l || l.link_type !== 'merged') throw notFound('merge', { linkId: input.linkId });
    if (l.decided_by === ctx.actor.staffId || l.second_reviewer_id === ctx.actor.staffId) {
      throw new DomainError('forbidden', 'someone who did not take part in the merge must reverse it', { reason: 'same_person' });
    }
    const other = await ctx.tx.selectFrom('patient.patient').select(['merged_into_patient_id']).where('id', '=', l.other_patient_id).forUpdate().executeTakeFirstOrThrow();
    if (other.merged_into_patient_id !== l.survivor_patient_id) throw conflict('this record has been merged elsewhere since', { reason: 'changed_since' });
    await ctx.tx.updateTable('patient.patient').set({ status: 'active', merged_into_patient_id: null, updated_by: actor(ctx) }).where('id', '=', l.other_patient_id).execute();
    const { id } = await ctx.tx
      .insertInto('patient.patient_link')
      .values({ tenant_id: ctx.tenantId, survivor_patient_id: l.survivor_patient_id, other_patient_id: l.other_patient_id, link_type: 'unmerged', decided_by: l.second_reviewer_id, second_reviewer_id: actor(ctx), reason: input.reason, decided_at: clock(caller), created_by: actor(ctx) })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'patient.patient_link', subjectId: id, patientId: l.other_patient_id, reason: input.reason, diff: { unmerged: l.id } });
    ctx.emit({ eventType: 'patient.unmerged', aggregateType: 'patient.patient', aggregateId: l.other_patient_id, payload: { survivorPatientId: l.survivor_patient_id, restoredPatientId: l.other_patient_id } });
    return { linkId: id, restoredPatientId: l.other_patient_id };
  });
}

// ---- no known allergies --------------------------------------------------------------------------------

/** Records that the patient was asked and has no known allergies (distinguishes "none" from "not asked"). */
export async function confirmNoKnownAllergies(db: Kysely<DB>, caller: Caller, input: { patientId: string }) {
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.confirm_nka' }, async (ctx) => {
    await livePatient(ctx.tx, input.patientId);
    const { rows } = await sql`SELECT 1 FROM clinical.allergy_intolerance WHERE patient_id = ${input.patientId} AND status = 'active' LIMIT 1`.execute(ctx.tx);
    if (rows.length) throw conflict('the patient has active allergies recorded', { reason: 'has_allergies' });
    const now = clock(caller);
    await ctx.tx.updateTable('patient.patient').set({ nka_confirmed_at: now, updated_by: actor(ctx) }).where('id', '=', input.patientId).execute();
    ctx.audit({ action: 'update', subjectType: 'patient.patient', subjectId: input.patientId, patientId: input.patientId, diff: { fields: ['nkaConfirmedAt'] } });
    return { patientId: input.patientId, nkaConfirmedAt: now };
  });
}

// ---- reads ---------------------------------------------------------------------------------------------

export async function patientRegistry(db: Kysely<DB>, caller: Caller, patientId: string, opts: { confidentialFlags: boolean }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const p = await tx.selectFrom('patient.patient').select(['id', 'status', 'merged_into_patient_id', 'nka_confirmed_at', 'deceased_at']).where('id', '=', patientId).executeTakeFirst();
    if (!p) throw notFound('patient', { patientId });
    const now = new Date();
    const [identifiers, related, consents, flags, links] = await Promise.all([
      tx.selectFrom('patient.patient_identifier').select(['id as identifierId', 'system', 'value', 'issuer', 'verified_at as verifiedAt', 'verified_via as verifiedVia', 'is_primary as isPrimary']).where('patient_id', '=', patientId).where('removed_at', 'is', null).orderBy('system').execute(),
      tx
        .selectFrom('patient.related_person')
        .select([
          'id as relatedPersonId', 'name', 'relationship', 'phone', 'is_guardian as isGuardian', 'is_emergency_contact as isEmergencyContact',
          'is_legal_representative as isLegalRepresentative', 'representative_scope as representativeScope', 'related_patient_id as relatedPatientId',
          'valid_to as validTo', 'version',
        ])
        .where('patient_id', '=', patientId)
        .orderBy('valid_to', 'desc')
        .execute(),
      tx
        .selectFrom('patient.patient_consent as c')
        .leftJoin('patient.related_person as r', 'r.id', 'c.related_person_id')
        .leftJoin('platform.staff as w', 'w.id', 'c.witness_staff_id')
        .select([
          'c.id as consentId', 'c.consent_type as consentType', 'c.status', 'c.signed_by as signedBy', 'r.name as signerName', 'w.display_name as witnessName',
          'c.signed_at as signedAt', 'c.expires_at as expiresAt', 'c.withdrawn_at as withdrawnAt', 'c.encounter_id as encounterId', 'c.language', 'c.notes',
        ])
        .where('c.patient_id', '=', patientId)
        .orderBy('c.signed_at', 'desc')
        .execute(),
      tx
        .selectFrom('patient.patient_flag as f')
        .innerJoin('platform.staff as s', 's.id', 'f.set_by')
        .select(['f.id as flagId', 'f.flag_type as flagType', 'f.active_from as activeFrom', 'f.active_to as activeTo', 's.display_name as setByName', 'f.reason', 'f.cleared_by as clearedBy'])
        .where('f.patient_id', '=', patientId)
        .orderBy('f.active_from', 'desc')
        .execute(),
      listLinksTx(tx, patientId),
    ]);
    // MLC and safeguarding reasons are sensitive: without the permission only the flag type shows.
    const visibleFlags = flags.map((f) => ({
      ...f,
      active: !f.clearedBy && (!f.activeTo || f.activeTo > now),
      reason: opts.confidentialFlags || !['mlc', 'safeguarding', 'confidential'].includes(f.flagType) ? f.reason : null,
    }));
    return {
      patientId,
      status: p.status,
      mergedIntoPatientId: p.merged_into_patient_id,
      nkaConfirmedAt: p.nka_confirmed_at,
      deceasedAt: p.deceased_at,
      identifiers,
      relatedPersons: related,
      consents,
      flags: visibleFlags,
      links,
    };
  });
}

async function listLinksTx(tx: Transaction<DB>, patientId: string) {
  return tx
    .selectFrom('patient.patient_link as l')
    .innerJoin('patient.patient as s', 's.id', 'l.survivor_patient_id')
    .innerJoin('patient.patient as o', 'o.id', 'l.other_patient_id')
    .select(['l.id as linkId', 'l.survivor_patient_id as survivorPatientId', 's.mrn as survivorMrn', 'l.other_patient_id as otherPatientId', 'o.mrn as otherMrn', 'l.link_type as linkType', 'l.decided_by as decidedBy', 'l.second_reviewer_id as secondReviewerId', 'l.reason', 'l.decided_at as decidedAt'])
    .where((eb) => eb.or([eb('l.survivor_patient_id', '=', patientId), eb('l.other_patient_id', '=', patientId)]))
    .orderBy('l.decided_at', 'desc')
    .execute();
}

/** The clinic-scoped helper for routes: which facility a sub-record's patient was registered at. */
export async function recordPatient(db: Kysely<DB>, caller: Caller, table: 'patient_identifier' | 'related_person' | 'patient_consent' | 'patient_flag', id: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom(`patient.${table}` as 'patient.patient_flag').select('patient_id').where('id', '=', id).executeTakeFirst())?.patient_id);
}
