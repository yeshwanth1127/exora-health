// Computerised order entry (ERD m06): service orders on an encounter, order sets, cancellation.
// A lab panel expands into one child item per test (catalog.service_component); an imaging item gets
// its imaging study (DICOM accession and study UID) at once.
import { randomUUID } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { actor, assertDiagnosticsActive, dicomUid, moveItem, nextNo, pad, refreshOrder, rollupPanel } from './state.ts';

const OPEN = ['arrived', 'in_progress'];
type Priority = 'routine' | 'urgent' | 'stat';

export interface OrderLineInput {
  serviceItemId: string;
  quantity?: number | undefined;
  details?: Record<string, unknown> | undefined;
  scheduledAt?: string | undefined;
  targetStaffId?: string | undefined;
}

export interface PlaceOrderInput {
  encounterId: string;
  priority?: Priority | undefined;
  clinicalIndication?: string | undefined;
  orderSetId?: string | undefined;
  items?: OrderLineInput[] | undefined;
}

/** Order sets the caller may use: their own, and active department sets of the clinic. */
async function usableSet(tx: Transaction<DB>, orderSetId: string, staffId: string) {
  const set = await tx
    .selectFrom('diagnostics.order_set as s')
    .leftJoin('platform.department as d', 'd.id', 's.department_id')
    .select(['s.id', 's.status', 's.owner_staff_id', 'd.facility_id'])
    .where('s.id', '=', orderSetId)
    .executeTakeFirst();
  if (!set || (set.owner_staff_id && set.owner_staff_id !== staffId)) throw notFound('order set', { orderSetId });
  if (set.status !== 'active') throw preconditionFailed('this order set was retired', { reason: 'retired' });
  return tx
    .selectFrom('diagnostics.order_set_item')
    .select(['service_item_id', 'default_details'])
    .where('order_set_id', '=', orderSetId)
    .where('removed_at', 'is', null)
    .orderBy('sequence')
    .execute();
}

export async function placeOrder(db: Kysely<DB>, caller: Caller, input: PlaceOrderInput, idempotencyKey: string) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.place_order', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const enc = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id', 'facility_id', 'status']).where('id', '=', input.encounterId).executeTakeFirst();
    if (!enc) throw notFound('encounter', { encounterId: input.encounterId });
    if (!OPEN.includes(enc.status)) throw preconditionFailed(`a ${enc.status} encounter can't take new orders`, { reason: 'encounter_closed' });
    await assertChartAccess(ctx.tx, me, enc.patient_id, now);

    const lines: OrderLineInput[] = [];
    if (input.orderSetId) {
      for (const s of await usableSet(ctx.tx, input.orderSetId, me)) lines.push({ serviceItemId: s.service_item_id, details: s.default_details as Record<string, unknown> });
    }
    for (const l of input.items ?? []) if (!lines.some((x) => x.serviceItemId === l.serviceItemId)) lines.push(l);
    if (!lines.length) throw invalid('an order needs at least one item', { reason: 'no_items' });
    if (lines.length > 50) throw invalid('at most 50 items per order');

    const ids = lines.map((l) => l.serviceItemId);
    const catalog = await ctx.tx
      .selectFrom('catalog.service_item')
      .select(['id', 'name', 'category', 'modality', 'is_orderable', 'status', 'performing_department_id'])
      .where('id', 'in', ids)
      .execute();
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const bad = ids.filter((id) => {
      const c = byId.get(id);
      return !c || !c.is_orderable || c.status !== 'active' || c.category === 'consultation' || c.category === 'bed_day' || c.category === 'package';
    });
    if (bad.length) throw invalid('some items cannot be ordered', { reason: 'not_orderable', serviceItemIds: bad });

    const year = now.toISOString().slice(0, 4);
    const requisitionNo = `RQ/${year}/${pad(await nextNo(ctx.tx, 'requisition', enc.facility_id, year))}`;
    const priority = input.priority ?? 'routine';
    const { id: orderId } = await ctx.tx
      .insertInto('diagnostics.service_order')
      .values({
        tenant_id: ctx.tenantId,
        encounter_id: enc.id,
        patient_id: enc.patient_id,
        facility_id: enc.facility_id,
        requisition_no: requisitionNo,
        priority,
        clinical_indication: input.clinicalIndication?.trim() || null,
        order_set_id: input.orderSetId ?? null,
        ordered_at: now,
        ordered_by: me,
        created_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const insertItem = (serviceItemId: string, l: Partial<OrderLineInput>, parentId: string | null, departmentId: string | null) =>
      ctx.tx
        .insertInto('diagnostics.order_item')
        .values({
          tenant_id: ctx.tenantId,
          service_order_id: orderId,
          patient_id: enc.patient_id,
          service_item_id: serviceItemId,
          performing_department_id: departmentId,
          panel_parent_item_id: parentId,
          target_staff_id: l.targetStaffId ?? null,
          quantity: l.quantity ?? 1,
          details: JSON.stringify(l.details ?? {}),
          scheduled_at: l.scheduledAt ?? null,
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    const items: { orderItemId: string; serviceItemId: string; name: string; category: string; children: { orderItemId: string; serviceItemId: string; name: string }[]; imagingStudyId?: string; accessionNo?: string }[] = [];
    for (const l of lines) {
      const c = byId.get(l.serviceItemId)!;
      const { id } = await insertItem(c.id, l, null, c.performing_department_id);
      const entry: (typeof items)[number] = { orderItemId: id, serviceItemId: c.id, name: c.name, category: c.category, children: [] };
      if (c.category === 'lab_panel') {
        const parts = await ctx.tx
          .selectFrom('catalog.service_component as sc')
          .innerJoin('catalog.service_item as s', 's.id', 'sc.child_item_id')
          .select(['s.id', 's.name', 's.performing_department_id', 's.status'])
          .where('sc.parent_item_id', '=', c.id)
          .orderBy('sc.sequence')
          .execute();
        const live = parts.filter((p) => p.status === 'active');
        if (!live.length) throw invalid(`${c.name} has no active tests`, { reason: 'empty_panel', serviceItemId: c.id });
        for (const p of live) entry.children.push({ orderItemId: (await insertItem(p.id, { details: {} }, id, p.performing_department_id ?? c.performing_department_id)).id, serviceItemId: p.id, name: p.name });
      }
      if (c.category === 'imaging') {
        const accessionNo = `${c.modality}${year.slice(2)}${pad(await nextNo(ctx.tx, 'imaging_accession', enc.facility_id, year), 7)}`;
        const { id: studyId } = await ctx.tx
          .insertInto('diagnostics.imaging_study')
          .values({
            tenant_id: ctx.tenantId,
            order_item_id: id,
            patient_id: enc.patient_id,
            facility_id: enc.facility_id,
            modality: c.modality!,
            accession_no: accessionNo,
            study_instance_uid: dicomUid(randomUUID()),
            scheduled_at: l.scheduledAt ?? null,
            is_obstetric: c.modality === 'US' && l.details?.obstetric === true,
            created_by: me,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        Object.assign(entry, { imagingStudyId: studyId, accessionNo });
      }
      items.push(entry);
      ctx.emit({
        eventType: 'order_item.placed',
        aggregateType: 'diagnostics.order_item',
        aggregateId: id,
        payload: { orderId, orderItemId: id, serviceItemId: c.id, category: c.category, quantity: l.quantity ?? 1, priority, encounterId: enc.id, patientId: enc.patient_id, facilityId: enc.facility_id, orderedBy: me },
      });
    }
    ctx.audit({ action: 'create', subjectType: 'diagnostics.service_order', subjectId: orderId, patientId: enc.patient_id, diff: { requisitionNo, priority, items: items.map((i) => i.serviceItemId) } });
    return { orderId, requisitionNo, status: 'active', items };
  });
}

const CANCELLABLE = ['ordered', 'scheduled', 'collected', 'in_progress'];

/** Cancels an item (a panel with all its tests) before any result exists; the last item cancels the order. */
export async function cancelOrderItem(db: Kysely<DB>, caller: Caller, input: { orderItemId: string; reason: string }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.cancel_order_item' }, async (ctx) => {
    const me = actor(ctx);
    const item = await ctx.tx
      .selectFrom('diagnostics.order_item')
      .select(['id', 'status', 'patient_id', 'panel_parent_item_id', 'service_order_id', 'service_item_id'])
      .where('id', '=', input.orderItemId)
      .forUpdate()
      .executeTakeFirst();
    if (!item) throw notFound('order item', { orderItemId: input.orderItemId });
    await assertChartAccess(ctx.tx, me, item.patient_id, now);
    if (item.status === 'cancelled') return { orderItemId: item.id, status: 'cancelled', orderStatus: await refreshOrder(ctx.tx, item.service_order_id, me) };
    const children = await ctx.tx.selectFrom('diagnostics.order_item').select(['id', 'status']).where('panel_parent_item_id', '=', item.id).forUpdate().execute();
    const resulted = [item, ...children].filter((i) => i.status !== 'cancelled' && !CANCELLABLE.includes(i.status));
    const hasResults = await ctx.tx.selectFrom('diagnostics.result_item').select('id').where('order_item_id', 'in', [item.id, ...children.map((c) => c.id)]).where('status', '<>', 'cancelled').executeTakeFirst();
    if (resulted.length || hasResults) throw preconditionFailed('results were already entered; ask the lab to amend the report instead', { reason: 'already_resulted' });

    const reason = input.reason.trim();
    const cancelled: string[] = [];
    for (const c of children) if (c.status !== 'cancelled') { await moveItem(ctx.tx, c, 'cancelled', { cancelReason: reason, at: now, by: me }); cancelled.push(c.id); }
    await moveItem(ctx.tx, item, 'cancelled', { cancelReason: reason, at: now, by: me });
    cancelled.push(item.id);
    await ctx.tx.updateTable('diagnostics.imaging_study').set({ status: 'cancelled', cancel_reason: reason, updated_by: me }).where('order_item_id', '=', item.id).where('status', 'in', ['scheduled', 'arrived', 'in_progress']).execute();
    await cancelOpenReports(ctx.tx, [item.id], reason, me);
    if (item.panel_parent_item_id) await rollupPanel(ctx.tx, item.panel_parent_item_id, me, now);
    const orderStatus = await refreshOrder(ctx.tx, item.service_order_id, me);
    ctx.audit({ action: 'status_change', subjectType: 'diagnostics.order_item', subjectId: item.id, patientId: item.patient_id, reason, diff: { status: 'cancelled', items: cancelled } });
    ctx.emit({ eventType: 'order_item.cancelled', aggregateType: 'diagnostics.order_item', aggregateId: item.id, payload: { orderId: item.service_order_id, orderItemId: item.id, cancelledItemIds: cancelled, serviceItemId: item.service_item_id, patientId: item.patient_id, reason } });
    return { orderItemId: item.id, status: 'cancelled', orderStatus };
  });
}

/** Draft reports of cancelled items are cancelled with them (a version records it). */
export async function cancelOpenReports(tx: Transaction<DB>, orderItemIds: string[], reason: string, by: string) {
  const open = await tx.selectFrom('diagnostics.diagnostic_report').select(['id', 'current_version', 'tenant_id']).where('order_item_id', 'in', orderItemIds).where('status', 'in', ['registered', 'preliminary']).forUpdate().execute();
  for (const r of open) {
    await tx.insertInto('diagnostics.diagnostic_report_version').values({ tenant_id: r.tenant_id, diagnostic_report_id: r.id, version_no: r.current_version + 1, status: 'cancelled', body: JSON.stringify({ reason }), created_by: by }).execute();
    await tx.updateTable('diagnostics.diagnostic_report').set({ status: 'cancelled', cancel_reason: reason, current_version: r.current_version + 1, updated_by: by }).where('id', '=', r.id).execute();
  }
}

// ---- order sets ----------------------------------------------------------------------------------------

export interface OrderSetItemInput {
  serviceItemId: string;
  priority?: Priority | undefined;
  details?: Record<string, unknown> | undefined;
}

async function checkOrderable(tx: Transaction<DB>, items: OrderSetItemInput[]) {
  const ids = [...new Set(items.map((i) => i.serviceItemId))];
  if (ids.length !== items.length) throw invalid('each service may appear once in a set', { reason: 'duplicate_item' });
  if (!ids.length) return;
  const found = await tx.selectFrom('catalog.service_item').select('id').where('id', 'in', ids).where('is_orderable', '=', true).where('status', '=', 'active').execute();
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw invalid('some items cannot be ordered', { reason: 'not_orderable', serviceItemIds: missing });
}

async function writeSetItems(tx: Transaction<DB>, tenantId: string, orderSetId: string, items: OrderSetItemInput[], by: string, now: Date) {
  const existing = await tx.selectFrom('diagnostics.order_set_item').select(['id', 'service_item_id']).where('order_set_id', '=', orderSetId).where('removed_at', 'is', null).execute();
  const keep = new Set(items.map((i) => i.serviceItemId));
  const gone = existing.filter((e) => !keep.has(e.service_item_id)).map((e) => e.id);
  if (gone.length) await tx.updateTable('diagnostics.order_set_item').set({ removed_at: now, updated_by: by }).where('id', 'in', gone).execute();
  for (const [i, it] of items.entries()) {
    const row = existing.find((e) => e.service_item_id === it.serviceItemId);
    const values = { default_priority: it.priority ?? 'routine', default_details: JSON.stringify(it.details ?? {}), sequence: i };
    if (row) await tx.updateTable('diagnostics.order_set_item').set({ ...values, updated_by: by }).where('id', '=', row.id).execute();
    else await tx.insertInto('diagnostics.order_set_item').values({ tenant_id: tenantId, order_set_id: orderSetId, service_item_id: it.serviceItemId, ...values, created_by: by }).execute();
  }
}

/** A personal set (no department) belongs to its author; a department set is shared by the clinic. */
export async function createOrderSet(db: Kysely<DB>, caller: Caller, input: { name: string; departmentId?: string | null | undefined; items: OrderSetItemInput[] }, idempotencyKey: string) {
  await assertDiagnosticsActive(db, caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.create_order_set', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    if (!input.items.length) throw invalid('an order set needs at least one item', { reason: 'no_items' });
    await checkOrderable(ctx.tx, input.items);
    const { id } = await ctx.tx
      .insertInto('diagnostics.order_set')
      .values({ tenant_id: ctx.tenantId, name: input.name.trim(), owner_staff_id: input.departmentId ? null : me, department_id: input.departmentId ?? null, created_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeSetItems(ctx.tx, ctx.tenantId, id, input.items, me, clock(caller));
    ctx.audit({ action: 'create', subjectType: 'diagnostics.order_set', subjectId: id, diff: { name: input.name, departmentId: input.departmentId ?? null, items: input.items.length } });
    return { orderSetId: id };
  });
}

/** The set's scope: its department's clinic (department set) or its owner (personal set). */
export async function orderSetScope(db: Kysely<DB>, caller: Caller, orderSetId: string) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('diagnostics.order_set as s')
      .leftJoin('platform.department as d', 'd.id', 's.department_id')
      .select(['s.owner_staff_id as ownerStaffId', 'd.facility_id as facilityId'])
      .where('s.id', '=', orderSetId)
      .executeTakeFirst(),
  );
}

export async function departmentFacility(db: Kysely<DB>, caller: Caller, departmentId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('platform.department').select('facility_id').where('id', '=', departmentId).executeTakeFirst())?.facility_id);
}

export async function updateOrderSet(db: Kysely<DB>, caller: Caller, input: { orderSetId: string; version: number; name?: string | undefined; items?: OrderSetItemInput[] | undefined; retire?: boolean | undefined }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.update_order_set' }, async (ctx) => {
    const me = actor(ctx);
    const s = await ctx.tx.selectFrom('diagnostics.order_set').selectAll().where('id', '=', input.orderSetId).forUpdate().executeTakeFirst();
    if (!s || (s.owner_staff_id && s.owner_staff_id !== me)) throw notFound('order set', { orderSetId: input.orderSetId });
    if (s.version !== input.version) throw conflict('this order set was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: s.version });
    if (s.status === 'retired') throw preconditionFailed('this order set was retired', { reason: 'retired' });
    if (input.items) {
      if (!input.items.length) throw invalid('an order set needs at least one item; retire it instead', { reason: 'no_items' });
      await checkOrderable(ctx.tx, input.items);
      await writeSetItems(ctx.tx, ctx.tenantId, s.id, input.items, me, now);
    }
    const set: Record<string, unknown> = { updated_by: me };
    if (input.name) set.name = input.name.trim();
    if (input.retire) Object.assign(set, { status: 'retired', retired_at: now });
    // Item edits bump the set's version too, so a stale editor can't overwrite them.
    const { version } = await ctx.tx.updateTable('diagnostics.order_set').set(set).where('id', '=', s.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: input.retire ? 'status_change' : 'update', subjectType: 'diagnostics.order_set', subjectId: s.id, diff: { name: input.name, items: input.items?.length, retired: !!input.retire } });
    return { orderSetId: s.id, version, status: input.retire ? 'retired' : s.status };
  });
}

export async function listOrderSets(db: Kysely<DB>, caller: Caller, f: { facilityId: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const sets = await tx
      .selectFrom('diagnostics.order_set as s')
      .leftJoin('platform.department as d', 'd.id', 's.department_id')
      .select(['s.id as orderSetId', 's.name', 's.owner_staff_id as ownerStaffId', 's.department_id as departmentId', 'd.name as departmentName', 's.version'])
      .where('s.status', '=', 'active')
      .where((eb) => eb.or([eb('s.owner_staff_id', '=', caller.actor.staffId ?? '00000000-0000-0000-0000-000000000000'), eb('d.facility_id', '=', f.facilityId)]))
      .orderBy('s.name')
      .execute();
    if (!sets.length) return [];
    const items = await tx
      .selectFrom('diagnostics.order_set_item as i')
      .innerJoin('catalog.service_item as si', 'si.id', 'i.service_item_id')
      .select(['i.order_set_id', 'i.service_item_id as serviceItemId', 'si.name', 'si.category', 'i.default_priority as priority', 'i.default_details as details'])
      .where('i.order_set_id', 'in', sets.map((s) => s.orderSetId))
      .where('i.removed_at', 'is', null)
      .orderBy('i.sequence')
      .execute();
    return sets.map((s) => ({ ...s, scope: s.ownerStaffId ? 'personal' : 'department', items: items.filter((i) => i.order_set_id === s.orderSetId).map(({ order_set_id: _, ...rest }) => rest) }));
  });
}

/** Orderable catalogue items (lab, imaging, procedures and other services), searched by name or code. */
export async function listOrderables(db: Kysely<DB>, caller: Caller, f: { q?: string | undefined; category?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const term = f.q?.trim();
    const { rows } = await sql<{ serviceItemId: string; code: string; name: string; category: string; modality: string | null; specimenType: string | null; section: string | null; prepInstructions: string | null }>`
      SELECT s.id AS "serviceItemId", s.code, s.name, s.category, s.modality, l.specimen_type AS "specimenType", l.section,
             s.prep_instructions AS "prepInstructions"
      FROM catalog.service_item s
      LEFT JOIN catalog.lab_test_def l ON l.service_item_id = s.id
      WHERE s.status = 'active' AND s.is_orderable
        AND s.category NOT IN ('consultation', 'bed_day', 'package')
        AND (${f.category ?? null}::text IS NULL OR s.category = ${f.category ?? null})
        AND (${term ?? null}::text IS NULL OR s.name ILIKE '%' || ${term ?? null} || '%' OR s.code ILIKE ${term ?? null} || '%')
      ORDER BY s.name
      LIMIT 50`.execute(tx);
    return rows;
  });
}

