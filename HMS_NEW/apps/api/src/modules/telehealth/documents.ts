// Teleconsultation consent documents (G34): drafted, published (then frozen by the table guard) and
// retired by administrators. The newest published, unretired version per language is what patients
// and staff read; publishing a new version supersedes the previous one without editing it.
import type { DB, Kysely } from '@hms/db';
import { sql } from '@hms/db';
import { conflict, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

export async function listConsentDocuments(db: Kysely<DB>, caller: Caller) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const rows = await tx
      .selectFrom('clinical.tele_consent_document')
      .select(['id as documentId', 'doc_version as docVersion', 'language', 'title', 'body', 'published_at as publishedAt', 'retired_at as retiredAt', 'version'])
      .orderBy('language')
      .orderBy('created_at', 'desc')
      .execute();
    const current = new Map<string, string>();
    for (const r of rows) {
      if (r.publishedAt && r.publishedAt <= now && (!r.retiredAt || r.retiredAt > now) && !current.has(r.language)) current.set(r.language, r.documentId);
    }
    return rows.map((r) => ({ ...r, state: r.retiredAt && r.retiredAt <= now ? 'retired' : r.publishedAt ? 'published' : 'draft', current: current.get(r.language) === r.documentId }));
  });
}

export async function draftConsentDocument(db: Kysely<DB>, caller: Caller, input: { docVersion: string; language: string; title: string; body: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.draft_consent_document', idempotencyKey, request: input }, async (ctx) => {
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.tele_consent_document')
        .values({ tenant_id: ctx.tenantId, doc_version: input.docVersion, language: input.language, title: input.title, body: input.body, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.tele_consent_document', subjectId: id, diff: { docVersion: input.docVersion, language: input.language } });
      return { documentId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that version already exists for this language', { reason: 'duplicate_version' });
      throw err;
    }
  });
}

export async function updateConsentDraft(db: Kysely<DB>, caller: Caller, input: { documentId: string; version: number; title?: string | undefined; body?: string | undefined }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.update_consent_document', idempotencyKey, request: input }, async (ctx) => {
    const d = await ctx.tx.selectFrom('clinical.tele_consent_document').selectAll().where('id', '=', input.documentId).forUpdate().executeTakeFirst();
    if (!d) throw notFound('consent document', { documentId: input.documentId });
    if (d.published_at) throw preconditionFailed('a published document is frozen; draft a new version instead', { reason: 'published' });
    if (d.version !== input.version) throw conflict('this draft was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: d.version });
    const set = Object.fromEntries(Object.entries({ title: input.title, body: input.body }).filter(([, v]) => v !== undefined));
    const { version } = await ctx.tx.updateTable('clinical.tele_consent_document').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', d.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'clinical.tele_consent_document', subjectId: d.id, diff: { fields: Object.keys(set) } });
    return { documentId: d.id, version };
  });
}

/** Publishing makes it the current document for its language and retires the one it replaces. */
export async function publishConsentDocument(db: Kysely<DB>, caller: Caller, input: { documentId: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.publish_consent_document', idempotencyKey, request: input }, async (ctx) => {
    // Distinct drafts must not both become current when administrators publish concurrently.
    // One tenant lock also serializes publication against retirement without lock-order inversion.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + ':consent-documents'}, 0))`.execute(ctx.tx);
    const d = await ctx.tx.selectFrom('clinical.tele_consent_document').selectAll().where('id', '=', input.documentId).forUpdate().executeTakeFirst();
    if (!d) throw notFound('consent document', { documentId: input.documentId });
    if (d.published_at) throw conflict('this document is already published', { reason: 'already_published' });
    const replaced = await ctx.tx
      .updateTable('clinical.tele_consent_document')
      .set({ retired_at: now, updated_by: ctx.actor.staffId ?? null })
      .where('language', '=', d.language)
      .where('published_at', 'is not', null)
      .where('retired_at', 'is', null)
      .returning('id')
      .execute();
    await ctx.tx.updateTable('clinical.tele_consent_document').set({ published_at: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', d.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.tele_consent_document', subjectId: d.id, diff: { published: true, retired: replaced.map((r) => r.id) } });
    return { documentId: d.id, publishedAt: now, retired: replaced.map((r) => r.id) };
  });
}

/** Retiring the current document switches teleconsultation consent off until another is published. */
export async function retireConsentDocument(db: Kysely<DB>, caller: Caller, input: { documentId: string; reason: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.retire_consent_document', idempotencyKey, request: input }, async (ctx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + ':consent-documents'}, 0))`.execute(ctx.tx);
    const d = await ctx.tx.selectFrom('clinical.tele_consent_document').selectAll().where('id', '=', input.documentId).forUpdate().executeTakeFirst();
    if (!d) throw notFound('consent document', { documentId: input.documentId });
    if (!d.published_at) throw preconditionFailed('only a published document can be retired', { reason: 'draft' });
    if (d.retired_at) return { documentId: d.id, retiredAt: d.retired_at };
    await ctx.tx.updateTable('clinical.tele_consent_document').set({ retired_at: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', d.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.tele_consent_document', subjectId: d.id, reason: input.reason, diff: { retired: true } });
    return { documentId: d.id, retiredAt: now };
  });
}
