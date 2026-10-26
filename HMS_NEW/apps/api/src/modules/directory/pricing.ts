// Fee changes. An active price list is frozen (catalog.price_list_item_guard) so every booking keeps
// pointing at the exact price it used; a change publishes the next version of the tenant's default cash
// list instead: copy every item, close the changed price at `effectiveFrom`, start the new one there,
// retire the old version and activate the new one, in the caller's transaction.
import { sql } from '@hms/db';
import type { CommandContext } from '@hms/platform';

/** in_person / virtual price one visit mode; any prices both unless a mode-specific price exists. */
export type PriceMode = 'in_person' | 'virtual' | 'any';

export const encounterClassOf = (mode: PriceMode) => (mode === 'in_person' ? 'outpatient' : mode === 'virtual' ? 'virtual' : null);

export interface PriceChange {
  serviceItemId: string;
  /** A doctor's own fee; null for the service's default fee. */
  staffId: string | null;
  mode: PriceMode;
  /** null removes the price from that date (a doctor then falls back to the service fee). */
  feeMinor: number | null;
  effectiveFrom: string;
  /** A bed category's daily price (the service is the tenant's bed-day item); omitted for fees. */
  bedCategoryId?: string | null | undefined;
}

export async function publishPrice(ctx: CommandContext, change: PriceChange): Promise<{ priceListId: string; listVersion: number }> {
  const tx = ctx.tx;
  const actor = ctx.actor.staffId ?? null;
  const encounterClass = encounterClassOf(change.mode);
  // Fee changes for the tenant run one at a time, so two can't both copy the same version.
  await sql`SELECT pg_advisory_xact_lock(hashtextextended('pricing:' || ${ctx.tenantId}, 0))`.execute(tx);
  const current = await tx
    .selectFrom('catalog.price_list')
    .selectAll()
    .where('status', '=', 'active')
    .where('is_default', '=', true)
    .forUpdate()
    .executeTakeFirst();
  const code = current?.code ?? 'CASH-STD';
  const { rows: [v] } = await sql<{ n: number }>`
    SELECT coalesce(max(list_version), 0)::int + 1 AS n FROM catalog.price_list WHERE code = ${code}`.execute(tx);
  const next = await tx
    .insertInto('catalog.price_list')
    .values({
      tenant_id: ctx.tenantId,
      code,
      name: current?.name ?? 'Standard cash rates',
      kind: 'cash',
      currency: current?.currency ?? 'INR',
      list_version: v!.n,
      valid_from: current && String(current.valid_from) < change.effectiveFrom ? current.valid_from : change.effectiveFrom,
      valid_to: current?.valid_to ?? null,
      created_by: actor,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  if (current) {
    // Every other price is copied as it is. Prices for the changed key stop at effectiveFrom (scheduled
    // later changes to the same key are replaced by this one).
    await sql`
      INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, item_id, item_group_id, bed_category_id, staff_id,
                                           encounter_class, unit_price_minor, item_pricing_method, percent_bp, charge_trigger, tax_rule_id,
                                           valid_from, valid_to, created_by)
      SELECT tenant_id, ${next.id}, service_item_id, item_id, item_group_id, bed_category_id, staff_id, encounter_class, unit_price_minor,
             item_pricing_method, percent_bp, charge_trigger, tax_rule_id, valid_from,
             CASE WHEN same THEN CASE WHEN valid_to IS NULL OR valid_to > ${change.effectiveFrom}::date THEN ${change.effectiveFrom}::date ELSE valid_to END
                  ELSE valid_to END,
             ${actor}
      FROM (SELECT *, (service_item_id = ${change.serviceItemId} AND bed_category_id IS NOT DISTINCT FROM ${change.bedCategoryId ?? null}::uuid
                       AND staff_id IS NOT DISTINCT FROM ${change.staffId}::uuid
                       AND encounter_class IS NOT DISTINCT FROM ${encounterClass}::text) AS same
            FROM catalog.price_list_item WHERE price_list_id = ${current.id}) i
      WHERE NOT (same AND valid_from >= ${change.effectiveFrom}::date)`.execute(tx);
  }
  if (change.feeMinor !== null) {
    await tx
      .insertInto('catalog.price_list_item')
      .values({
        tenant_id: ctx.tenantId,
        price_list_id: next.id,
        service_item_id: change.serviceItemId,
        staff_id: change.staffId,
        bed_category_id: change.bedCategoryId ?? null,
        encounter_class: encounterClass,
        unit_price_minor: change.feeMinor,
        charge_trigger: change.bedCategoryId ? 'daily' : 'on_order',
        valid_from: change.effectiveFrom,
        created_by: actor,
      })
      .execute();
  }
  if (current) await tx.updateTable('catalog.price_list').set({ status: 'retired', updated_by: actor }).where('id', '=', current.id).execute();
  await tx
    .updateTable('catalog.price_list')
    .set({ status: 'active', is_default: true, activated_at: new Date(), activated_by: actor, updated_by: actor })
    .where('id', '=', next.id)
    .execute();
  ctx.audit({
    action: 'update',
    subjectType: 'catalog.price_list',
    subjectId: next.id,
    reason: 'fee changed',
    diff: { replaces: current?.id ?? null, listVersion: v!.n, serviceItemId: change.serviceItemId, staffId: change.staffId, bedCategoryId: change.bedCategoryId ?? null, mode: change.mode, feeMinor: change.feeMinor, effectiveFrom: change.effectiveFrom },
  });
  return { priceListId: next.id, listVersion: v!.n };
}
