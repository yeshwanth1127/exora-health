// Inventory master data (ERD m10): item groups, items with their drug profile and pack sizes, stores,
// suppliers, per-store stock levels, and batch status (quarantine / recall).
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, notFound, invalid, runCommand } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { actor, assertInventoryActive, stockError } from './state.ts';

const stale = (current: number, expected: number, what: string) => {
  if (current !== expected) throw conflict(`this ${what} was changed by someone else; reload and try again`, { reason: 'stale_version', currentVersion: current });
};

type Opt<T> = T | undefined;

export interface DrugInput {
  genericName: string;
  brandName?: Opt<string>;
  strength?: Opt<string>;
  dosageForm: string;
  defaultRoute?: Opt<string>;
  manufacturer?: Opt<string>;
  regulatorySchedule?: Opt<'none' | 'G' | 'H' | 'H1' | 'X'>;
  isNdps?: Opt<boolean>;
  isHighAlert?: Opt<boolean>;
  teleList?: Opt<'list_o' | 'list_a' | 'list_b' | 'prohibited'>;
  isNlem?: Opt<boolean>;
}
export interface UomInput {
  uom: string;
  factorToBase: number;
  isPurchaseUom?: Opt<boolean>;
  isIssueUom?: Opt<boolean>;
}
export interface ItemInput {
  code: string;
  name: string;
  itemType: 'drug' | 'consumable' | 'implant' | 'reagent' | 'vaccine' | 'general';
  baseUom: string;
  hsnCode?: Opt<string>;
  itemGroupId?: Opt<string>;
  isBatchTracked?: Opt<boolean>;
  isExpiryTracked?: Opt<boolean>;
  isSerialTracked?: Opt<boolean>;
  isColdChain?: Opt<boolean>;
  isBillable?: Opt<boolean>;
  reorderLevel?: Opt<number>;
  drug?: Opt<DrugInput>;
  uoms?: Opt<UomInput[]>;
}

const drugRow = (d: Partial<DrugInput>) => ({
  ...(d.genericName !== undefined && { generic_name: d.genericName }),
  ...(d.brandName !== undefined && { brand_name: d.brandName || null }),
  ...(d.strength !== undefined && { strength: d.strength || null }),
  ...(d.dosageForm !== undefined && { dosage_form: d.dosageForm }),
  ...(d.defaultRoute !== undefined && { default_route: d.defaultRoute || null }),
  ...(d.manufacturer !== undefined && { manufacturer: d.manufacturer || null }),
  ...(d.regulatorySchedule !== undefined && { regulatory_schedule: d.regulatorySchedule }),
  ...(d.isNdps !== undefined && { is_ndps: d.isNdps }),
  ...(d.isHighAlert !== undefined && { is_high_alert: d.isHighAlert }),
  ...(d.teleList !== undefined && { tele_list: d.teleList ?? null }),
  ...(d.isNlem !== undefined && { is_nlem: d.isNlem }),
});

async function upsertUoms(tx: Transaction<DB>, tenantId: string, itemId: string, uoms: UomInput[], me: string) {
  for (const u of uoms) {
    await tx
      .insertInto('inventory.item_uom')
      .values({ tenant_id: tenantId, item_id: itemId, uom: u.uom, factor_to_base: u.factorToBase, is_purchase_uom: u.isPurchaseUom ?? false, is_issue_uom: u.isIssueUom ?? false, created_by: me, updated_by: me })
      .onConflict((oc) =>
        oc.columns(['tenant_id', 'item_id', 'uom']).doUpdateSet((eb) => ({
          factor_to_base: eb.ref('excluded.factor_to_base'),
          is_purchase_uom: eb.ref('excluded.is_purchase_uom'),
          is_issue_uom: eb.ref('excluded.is_issue_uom'),
          updated_by: me,
        })),
      )
      .execute();
  }
}

export async function createItemGroup(db: Kysely<DB>, caller: Caller, input: { code: string; name: string; parentId?: Opt<string> }, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_item_group', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const { id } = await ctx.tx.insertInto('inventory.item_group').values({ tenant_id: ctx.tenantId, code: input.code, name: input.name, parent_id: input.parentId ?? null, created_by: me, updated_by: me }).returning('id').executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'inventory.item_group', subjectId: id, diff: { ...input } });
    return { itemGroupId: id };
  }).catch(stockError);
}

export async function createItem(db: Kysely<DB>, caller: Caller, input: ItemInput, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  if ((input.itemType === 'drug') !== (input.drug !== undefined)) throw invalid('a drug needs a drug profile, and only drugs have one', { reason: 'drug_profile' });
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_item', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const batch = input.isBatchTracked ?? input.itemType !== 'general';
    const { id } = await ctx.tx
      .insertInto('inventory.item')
      .values({
        tenant_id: ctx.tenantId,
        code: input.code,
        name: input.name,
        item_type: input.itemType,
        base_uom: input.baseUom,
        hsn_code: input.hsnCode ?? null,
        item_group_id: input.itemGroupId ?? null,
        is_batch_tracked: batch,
        is_expiry_tracked: input.isExpiryTracked ?? batch,
        is_serial_tracked: input.isSerialTracked ?? input.itemType === 'implant',
        is_cold_chain: input.isColdChain ?? input.itemType === 'vaccine',
        is_billable: input.isBillable ?? true,
        reorder_level: input.reorderLevel ?? 0,
        created_by: me,
        updated_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (input.drug) await ctx.tx.insertInto('inventory.drug_product').values({ tenant_id: ctx.tenantId, item_id: id, generic_name: input.drug.genericName, dosage_form: input.drug.dosageForm, ...drugRow(input.drug), created_by: me, updated_by: me }).execute();
    await upsertUoms(ctx.tx, ctx.tenantId, id, input.uoms ?? [], me);
    ctx.audit({ action: 'create', subjectType: 'inventory.item', subjectId: id, diff: { code: input.code, name: input.name, itemType: input.itemType } });
    ctx.emit({ eventType: 'inventory.item_created', aggregateType: 'inventory.item', aggregateId: id, payload: { itemId: id, code: input.code, itemType: input.itemType } });
    return { itemId: id };
  }).catch(stockError);
}

export async function updateItem(
  db: Kysely<DB>,
  caller: Caller,
  input: { itemId: string; version: number; name?: Opt<string>; hsnCode?: Opt<string | null>; itemGroupId?: Opt<string | null>; reorderLevel?: Opt<number>; isBillable?: Opt<boolean>; isColdChain?: Opt<boolean>; status?: Opt<'active' | 'inactive'>; drug?: Opt<Partial<DrugInput>>; uoms?: Opt<UomInput[]> },
) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.update_item' }, async (ctx) => {
    const me = actor(ctx);
    const item = await ctx.tx.selectFrom('inventory.item').select(['id', 'version', 'item_type']).where('id', '=', input.itemId).forUpdate().executeTakeFirst();
    if (!item) throw notFound('item', { itemId: input.itemId });
    stale(item.version, input.version, 'item');
    const { itemId, version, drug, uoms, ...rest } = input;
    await ctx.tx
      .updateTable('inventory.item')
      .set({
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.hsnCode !== undefined && { hsn_code: rest.hsnCode }),
        ...(rest.itemGroupId !== undefined && { item_group_id: rest.itemGroupId }),
        ...(rest.reorderLevel !== undefined && { reorder_level: rest.reorderLevel }),
        ...(rest.isBillable !== undefined && { is_billable: rest.isBillable }),
        ...(rest.isColdChain !== undefined && { is_cold_chain: rest.isColdChain }),
        ...(rest.status !== undefined && { status: rest.status }),
        updated_by: me,
      })
      .where('id', '=', itemId)
      .execute();
    if (drug) {
      if (item.item_type !== 'drug') throw invalid('only drugs have a drug profile', { reason: 'drug_profile' });
      const set = drugRow(drug);
      if (Object.keys(set).length) await ctx.tx.updateTable('inventory.drug_product').set({ ...set, updated_by: me }).where('item_id', '=', itemId).execute();
    }
    await upsertUoms(ctx.tx, ctx.tenantId, itemId, uoms ?? [], me);
    ctx.audit({ action: 'update', subjectType: 'inventory.item', subjectId: itemId, diff: { ...rest, drug, uoms } });
    return { itemId, version: version + 1 };
  }).catch(stockError);
}

export interface StoreInput {
  facilityId: string;
  code: string;
  name: string;
  storeType: 'central' | 'pharmacy' | 'ward' | 'theatre' | 'icu' | 'lab' | 'emergency';
  locationId?: Opt<string>;
  parentStoreId?: Opt<string>;
  canDispenseToPatient?: Opt<boolean>;
  drugLicenceNo?: Opt<string>;
}

export async function createStore(db: Kysely<DB>, caller: Caller, input: StoreInput, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_store', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    if (input.canDispenseToPatient && !input.drugLicenceNo) throw invalid('a store that dispenses to patients needs its drug licence number', { reason: 'drug_licence_required' });
    if (input.parentStoreId) {
      const parent = await ctx.tx.selectFrom('inventory.store').select('facility_id').where('id', '=', input.parentStoreId).executeTakeFirst();
      if (!parent || parent.facility_id !== input.facilityId) throw notFound('parent store in this clinic', { parentStoreId: input.parentStoreId });
    }
    const { id } = await ctx.tx
      .insertInto('inventory.store')
      .values({
        tenant_id: ctx.tenantId,
        facility_id: input.facilityId,
        code: input.code,
        name: input.name,
        store_type: input.storeType,
        location_id: input.locationId ?? null,
        parent_store_id: input.parentStoreId ?? null,
        can_dispense_to_patient: input.canDispenseToPatient ?? false,
        drug_licence_no: input.drugLicenceNo ?? null,
        created_by: me,
        updated_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'inventory.store', subjectId: id, diff: { ...input } });
    return { storeId: id };
  }).catch(stockError);
}

export async function updateStore(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; version: number; name?: Opt<string>; parentStoreId?: Opt<string | null>; canDispenseToPatient?: Opt<boolean>; drugLicenceNo?: Opt<string | null>; status?: Opt<'active' | 'inactive'> },
) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.update_store' }, async (ctx) => {
    const me = actor(ctx);
    const s = await ctx.tx.selectFrom('inventory.store').select(['id', 'version', 'facility_id']).where('id', '=', input.storeId).forUpdate().executeTakeFirst();
    if (!s) throw notFound('store', { storeId: input.storeId });
    stale(s.version, input.version, 'store');
    if (input.parentStoreId) {
      const parent = await ctx.tx.selectFrom('inventory.store').select('facility_id').where('id', '=', input.parentStoreId).executeTakeFirst();
      if (!parent || parent.facility_id !== s.facility_id) throw notFound('parent store in this clinic', { parentStoreId: input.parentStoreId });
    }
    await ctx.tx
      .updateTable('inventory.store')
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.parentStoreId !== undefined && { parent_store_id: input.parentStoreId }),
        ...(input.canDispenseToPatient !== undefined && { can_dispense_to_patient: input.canDispenseToPatient }),
        ...(input.drugLicenceNo !== undefined && { drug_licence_no: input.drugLicenceNo }),
        ...(input.status !== undefined && { status: input.status }),
        updated_by: me,
      })
      .where('id', '=', s.id)
      .execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.store', subjectId: s.id, diff: { ...input } });
    return { storeId: s.id, version: input.version + 1 };
  }).catch(stockError);
}

export async function setStoreItemLevel(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; itemId: string; minLevel: number; maxLevel?: Opt<number | null>; reorderQty?: Opt<number | null>; binLocation?: Opt<string | null> },
) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.set_store_item_level' }, async (ctx) => {
    const me = actor(ctx);
    const row = { min_level: input.minLevel, max_level: input.maxLevel ?? null, reorder_qty: input.reorderQty ?? null, bin_location: input.binLocation ?? null, updated_by: me };
    const { id } = await ctx.tx
      .insertInto('inventory.store_item_setting')
      .values({ tenant_id: ctx.tenantId, store_id: input.storeId, item_id: input.itemId, ...row, created_by: me })
      .onConflict((oc) => oc.columns(['tenant_id', 'store_id', 'item_id']).doUpdateSet(row))
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'inventory.store_item_setting', subjectId: id, diff: { ...input } });
    return { settingId: id };
  }).catch(stockError);
}

export interface SupplierInput {
  code: string;
  name: string;
  gstin?: Opt<string>;
  stateCode?: Opt<string>;
  drugLicenceNo?: Opt<string>;
  pan?: Opt<string>;
  phone?: Opt<string>;
  email?: Opt<string>;
  address?: Opt<string>;
  paymentTermsDays?: Opt<number>;
}

const supplierRow = (s: Partial<SupplierInput>) => ({
  ...(s.name !== undefined && { name: s.name }),
  ...(s.gstin !== undefined && { gstin: s.gstin || null, state_code: s.stateCode ?? (s.gstin ? s.gstin.slice(0, 2) : null) }),
  ...(s.gstin === undefined && s.stateCode !== undefined && { state_code: s.stateCode || null }),
  ...(s.drugLicenceNo !== undefined && { drug_licence_no: s.drugLicenceNo || null }),
  ...(s.pan !== undefined && { pan: s.pan || null }),
  ...(s.phone !== undefined && { phone: s.phone || null }),
  ...(s.email !== undefined && { email: s.email || null }),
  ...(s.address !== undefined && { address: s.address || null }),
  ...(s.paymentTermsDays !== undefined && { payment_terms_days: s.paymentTermsDays }),
});

export async function createSupplier(db: Kysely<DB>, caller: Caller, input: SupplierInput, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_supplier', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const { id } = await ctx.tx.insertInto('inventory.supplier').values({ tenant_id: ctx.tenantId, code: input.code, name: input.name, ...supplierRow(input), created_by: me, updated_by: me }).returning('id').executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'inventory.supplier', subjectId: id, diff: { code: input.code, name: input.name, gstin: input.gstin } });
    return { supplierId: id };
  }).catch(stockError);
}

export async function updateSupplier(db: Kysely<DB>, caller: Caller, input: Partial<SupplierInput> & { supplierId: string; version: number; status?: Opt<'active' | 'blocked'> }) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.update_supplier' }, async (ctx) => {
    const me = actor(ctx);
    const s = await ctx.tx.selectFrom('inventory.supplier').select(['id', 'version']).where('id', '=', input.supplierId).forUpdate().executeTakeFirst();
    if (!s) throw notFound('supplier', { supplierId: input.supplierId });
    stale(s.version, input.version, 'supplier');
    await ctx.tx.updateTable('inventory.supplier').set({ ...supplierRow(input), ...(input.status !== undefined && { status: input.status }), updated_by: me }).where('id', '=', s.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.supplier', subjectId: s.id, diff: { ...input } });
    return { supplierId: s.id, version: input.version + 1 };
  }).catch(stockError);
}

/** Quarantine, recall or release a batch. Recalls go out as an event so pharmacy and wards can act. */
export async function setBatchStatus(db: Kysely<DB>, caller: Caller, input: { batchId: string; status: 'available' | 'quarantined' | 'recalled'; reason?: Opt<string> }) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.set_batch_status' }, async (ctx) => {
    const me = actor(ctx);
    const b = await ctx.tx.selectFrom('inventory.item_batch').select(['id', 'status', 'item_id', 'batch_no']).where('id', '=', input.batchId).forUpdate().executeTakeFirst();
    if (!b) throw notFound('batch', { batchId: input.batchId });
    if (b.status === 'recalled' && input.status !== 'recalled') throw conflict('a recalled batch stays recalled; return it to the vendor or dispose of it', { reason: 'recalled' });
    if (input.status !== 'available' && !input.reason) throw invalid('say why the batch is held', { reason: 'reason_required' });
    await ctx.tx.updateTable('inventory.item_batch').set({ status: input.status, status_reason: input.status === 'available' ? null : input.reason!, updated_by: me }).where('id', '=', b.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.item_batch', subjectId: b.id, ...(input.reason && { reason: input.reason }), diff: { from: b.status, to: input.status } });
    if (input.status === 'recalled') ctx.emit({ eventType: 'inventory.batch_recalled', aggregateType: 'inventory.item_batch', aggregateId: b.id, payload: { batchId: b.id, itemId: b.item_id, batchNo: b.batch_no, reason: input.reason } });
    return { batchId: b.id, status: input.status };
  }).catch(stockError);
}
