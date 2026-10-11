// Shared pieces of M06: the module switch, where a record lives (for authorization), and order item
// status moves. Item moves follow the database transition guard; a panel's parent item follows its tests.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { forbidden, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { assertModuleActive } from '../access/admin.ts';

export const actor = (ctx: { actor: { staffId?: string | undefined } }): string => {
  if (!ctx.actor.staffId) throw forbidden('only staff can work on orders and results');
  return ctx.actor.staffId;
};

/** Diagnostics is an optional module: a suspended module refuses new work (reads stay available). */
export const assertDiagnosticsActive = (db: Kysely<DB>, caller: Caller) => assertModuleActive(db, caller, 'diagnostics');

export type Located = { facilityId: string; patientId: string; category?: string | null; reportType?: string | null; ownerStaffId?: string | null } | undefined;

/** Facility (and patient) of a diagnostics record, for the route's permission check. */
export async function locate(
  db: Kysely<DB>,
  caller: Caller,
  kind: 'order_item' | 'specimen' | 'result_item' | 'micro_isolate' | 'diagnostic_report' | 'imaging_study',
  id: string,
): Promise<Located> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const q = {
      order_item: sql`SELECT o.facility_id, oi.patient_id, si.category, NULL::text AS report_type
                      FROM diagnostics.order_item oi JOIN diagnostics.service_order o ON o.id = oi.service_order_id
                      JOIN catalog.service_item si ON si.id = oi.service_item_id WHERE oi.id = ${id}`,
      specimen: sql`SELECT facility_id, patient_id, NULL::text AS category, NULL::text AS report_type FROM diagnostics.specimen WHERE id = ${id}`,
      result_item: sql`SELECT o.facility_id, r.patient_id, NULL::text AS category, NULL::text AS report_type
                       FROM diagnostics.result_item r JOIN diagnostics.order_item oi ON oi.id = r.order_item_id
                       JOIN diagnostics.service_order o ON o.id = oi.service_order_id WHERE r.id = ${id}`,
      micro_isolate: sql`SELECT o.facility_id, m.patient_id, NULL::text AS category, NULL::text AS report_type
                         FROM diagnostics.micro_isolate m JOIN diagnostics.order_item oi ON oi.id = m.order_item_id
                         JOIN diagnostics.service_order o ON o.id = oi.service_order_id WHERE m.id = ${id}`,
      diagnostic_report: sql`SELECT o.facility_id, d.patient_id, NULL::text AS category, d.report_type
                             FROM diagnostics.diagnostic_report d JOIN diagnostics.order_item oi ON oi.id = d.order_item_id
                             JOIN diagnostics.service_order o ON o.id = oi.service_order_id WHERE d.id = ${id}`,
      imaging_study: sql`SELECT facility_id, patient_id, NULL::text AS category, NULL::text AS report_type FROM diagnostics.imaging_study WHERE id = ${id}`,
    }[kind];
    const { rows: [r] } = await sql<{ facility_id: string; patient_id: string; category: string | null; report_type: string | null }>`${q}`.execute(tx);
    return r ? { facilityId: r.facility_id, patientId: r.patient_id, category: r.category, reportType: r.report_type } : undefined;
  });
}

const PATH = ['ordered', 'scheduled', 'collected', 'in_progress', 'resulted', 'released'] as const;
const DIRECT = new Set([
  'ordered>scheduled', 'ordered>collected', 'ordered>in_progress', 'ordered>cancelled',
  'scheduled>collected', 'scheduled>in_progress', 'scheduled>cancelled',
  'collected>in_progress', 'collected>ordered', 'collected>cancelled',
  'in_progress>resulted', 'in_progress>ordered', 'in_progress>cancelled',
  'resulted>released', 'resulted>in_progress',
]);
const rank = (s: string) => PATH.indexOf(s as (typeof PATH)[number]);

export interface ItemRow {
  id: string;
  status: string;
  panel_parent_item_id: string | null;
  service_order_id: string;
}

/** Moves an item to `to`, stepping through in_progress / resulted when a direct move isn't allowed. */
export async function moveItem(tx: Transaction<DB>, item: { id: string; status: string }, to: string, extra: { cancelReason?: string; at?: Date; by?: string } = {}) {
  if (item.status === to) return;
  const steps: string[] = [];
  if (DIRECT.has(`${item.status}>${to}`) || rank(to) < 0) steps.push(to);
  else {
    if (rank(item.status) < rank('in_progress') && rank(to) > rank('in_progress')) steps.push('in_progress');
    if (rank(item.status) < rank('resulted') && rank(to) > rank('resulted')) steps.push('resulted');
    steps.push(to);
  }
  for (const s of steps) {
    await tx
      .updateTable('diagnostics.order_item')
      .set(s === 'cancelled' ? { status: s, cancel_reason: extra.cancelReason ?? 'cancelled', cancelled_at: extra.at ?? new Date(), cancelled_by: extra.by ?? null, updated_by: extra.by ?? null } : { status: s, updated_by: extra.by ?? null })
      .where('id', '=', item.id)
      .execute();
  }
  item.status = to;
}

/** A panel's parent item follows its least advanced live test; with every test cancelled it is cancelled too. */
export async function rollupPanel(tx: Transaction<DB>, parentId: string, by: string, at: Date) {
  const parent = await tx.selectFrom('diagnostics.order_item').select(['id', 'status']).where('id', '=', parentId).forUpdate().executeTakeFirstOrThrow();
  if (parent.status === 'cancelled') return;
  const children = await tx.selectFrom('diagnostics.order_item').select('status').where('panel_parent_item_id', '=', parentId).execute();
  const live = children.map((c) => c.status).filter((s) => s !== 'cancelled');
  if (!live.length) return moveItem(tx, parent, 'cancelled', { cancelReason: 'all tests of the panel were cancelled', at, by });
  const target = live.reduce((a, b) => (rank(a) <= rank(b) ? a : b));
  await moveItem(tx, parent, target, { by });
}

/** An order is cancelled when every item is, and completed when every live item is released. */
export async function refreshOrder(tx: Transaction<DB>, orderId: string, by: string) {
  const order = await tx.selectFrom('diagnostics.service_order').select(['id', 'status']).where('id', '=', orderId).forUpdate().executeTakeFirstOrThrow();
  if (order.status !== 'active') return order.status;
  const items = await tx.selectFrom('diagnostics.order_item').select('status').where('service_order_id', '=', orderId).where('panel_parent_item_id', 'is', null).execute();
  const live = items.filter((i) => i.status !== 'cancelled');
  const next = !live.length ? 'cancelled' : live.every((i) => i.status === 'released') ? 'completed' : null;
  if (next) await tx.updateTable('diagnostics.service_order').set({ status: next, updated_by: by }).where('id', '=', orderId).execute();
  return next ?? order.status;
}

/** Moves leaf items, then rolls their panels up. */
export async function moveItems(tx: Transaction<DB>, items: ItemRow[], to: string, by: string, at: Date) {
  for (const it of items) await moveItem(tx, it, to, { by, at });
  for (const parent of new Set(items.map((i) => i.panel_parent_item_id).filter((p): p is string => !!p))) await rollupPanel(tx, parent, by, at);
}

export const pad = (n: number, width = 6) => String(n).padStart(width, '0');

export async function nextNo(tx: Transaction<DB>, series: string, facilityId: string, year: string): Promise<number> {
  const { rows: [r] } = await sql<{ n: number }>`SELECT platform.next_number(${series}, ${facilityId}::uuid, ${year}) AS n`.execute(tx);
  return Number(r!.n);
}

/** A DICOM UID from a UUID (the 2.25 root, ISO/IEC 9834-8). */
export const dicomUid = (uuid: string) => `2.25.${BigInt(`0x${uuid.replaceAll('-', '')}`).toString()}`;
