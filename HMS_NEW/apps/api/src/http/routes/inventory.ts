// Inventory over HTTP (ERD m10). Master data (items, groups, suppliers) is hospital-wide; stores and
// everything that moves stock are checked at the clinic of the store involved.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import {
  adjustStock,
  approveRequisition,
  approveStockCount,
  approveSupplierInvoice,
  cancelRequisition,
  createItem,
  createItemGroup,
  createPurchaseOrder,
  createRequisition,
  createStore,
  createSupplier,
  dispatchTransfer,
  expiringStock,
  facilityOf,
  getItem,
  getStockCount,
  invoiceFacilities,
  listGoodsReceipts,
  listItemGroups,
  listItems,
  listPurchaseOrders,
  listRequisitions,
  listStockCounts,
  listStores,
  listSupplierInvoices,
  listSuppliers,
  listTransfers,
  lowStock,
  movePurchaseOrder,
  openStockCount,
  postOpeningStock,
  receiptFacilities,
  receiveGoods,
  receiveTransfer,
  recordStockCount,
  recordSupplierInvoice,
  returnToVendor,
  setBatchStatus,
  setStoreItemLevel,
  stockLedger,
  storeStock,
  submitStockCount,
  updateItem,
  updateStore,
  updateSupplier,
  type Kind,
} from '../../modules/inventory/index.ts';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const Qty = z.number().positive().max(10_000_000).multipleOf(0.001);
const SignedQty = z.number().min(-10_000_000).max(10_000_000).multipleOf(0.001).refine((n) => n !== 0, 'quantity cannot be 0');
const Minor = z.number().int().min(0).max(1e12);
const Reason = z.string().trim().min(3).max(500);
const Version = z.number().int().min(1);
const Code = (max: number) => z.string().trim().toUpperCase().regex(new RegExp(`^[A-Z0-9_-]{1,${max}}$`), `letters, digits, _ or - (up to ${max})`);
const Name = z.string().trim().min(2).max(200);
const Uom = z.string().trim().toLowerCase().regex(/^[a-z_]{1,20}$/, 'a unit like tablet, ml, strip');
const Lines = <T extends z.ZodType>(t: T) => z.array(t).min(1).max(200);
const Gstin = z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, 'a 15-character GSTIN');
const Drug = z.object({
  genericName: z.string().trim().min(2).max(200),
  brandName: z.string().trim().max(200).optional(),
  strength: z.string().trim().max(60).optional(),
  dosageForm: z.enum(['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'infusion', 'ointment', 'cream', 'drops', 'inhaler', 'suppository', 'powder', 'patch', 'other']),
  defaultRoute: z.enum(['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'vaginal', 'other']).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  regulatorySchedule: z.enum(['none', 'G', 'H', 'H1', 'X']).optional(),
  isNdps: z.boolean().optional(),
  isHighAlert: z.boolean().optional(),
  teleList: z.enum(['list_o', 'list_a', 'list_b', 'prohibited']).optional(),
  isNlem: z.boolean().optional(),
});
const UomRow = z.object({ uom: Uom, factorToBase: Qty, isPurchaseUom: z.boolean().optional(), isIssueUom: z.boolean().optional() });
const Batch = {
  itemId: uuid,
  batchNo: z.string().trim().min(1).max(40).optional(),
  expiryDate: isoDate.optional(),
  manufacturedOn: isoDate.optional(),
  mrpMinor: Minor.optional(),
  unitCostMinor: Minor.optional(),
};
const Serials = z.array(z.string().trim().min(1).max(60)).max(500).optional();

export function registerInventoryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** Checks `permission` at the clinic of an inventory record (404 when it doesn't exist). */
  async function at(request: FastifyRequest, kind: Kind, id: string, permission: string) {
    const facilityId = await facilityOf(db, callerOf(request), kind, id);
    if (!facilityId && kind !== 'item_batch') throw new DomainError('not_found', `${kind.replace('_', ' ')} not found`);
    authorize(principalOf(request), permission, facilityId ?? null);
    return facilityId;
  }

  // ---- items and groups (hospital-wide) ---------------------------------------------------------------------
  app.get('/v1/inventory/items', async (request) => {
    const q = parse(z.object({ q: z.string().trim().max(100).optional(), itemType: z.enum(['drug', 'consumable', 'implant', 'reagent', 'vaccine', 'general']).optional(), includeInactive: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }), request.query);
    authorize(principalOf(request), 'inventory.read');
    return { items: await listItems(db, callerOf(request), q) };
  });

  app.get('/v1/inventory/items/:itemId', async (request) => {
    const { itemId } = parse(z.object({ itemId: uuid }), request.params);
    authorize(principalOf(request), 'inventory.read');
    return getItem(db, callerOf(request), itemId);
  });

  app.post('/v1/inventory/items', async (request, reply) => {
    const body = parse(
      z.object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_./-]{1,40}$/, 'letters, digits, _ . / - (up to 40)'),
        name: Name,
        itemType: z.enum(['drug', 'consumable', 'implant', 'reagent', 'vaccine', 'general']),
        baseUom: Uom,
        hsnCode: z.string().regex(/^[0-9]{4,8}$/, '4–8 digit HSN code').optional(),
        itemGroupId: uuid.optional(),
        isBatchTracked: z.boolean().optional(),
        isExpiryTracked: z.boolean().optional(),
        isSerialTracked: z.boolean().optional(),
        isColdChain: z.boolean().optional(),
        isBillable: z.boolean().optional(),
        reorderLevel: z.number().min(0).max(10_000_000).optional(),
        drug: Drug.optional(),
        uoms: z.array(UomRow).max(10).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'inventory.manage');
    return reply.status(201).send(await createItem(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/inventory/items/:itemId', async (request) => {
    const { itemId } = parse(z.object({ itemId: uuid }), request.params);
    const body = parse(
      z.object({
        version: Version,
        name: Name.optional(),
        hsnCode: z.string().regex(/^[0-9]{4,8}$/).nullable().optional(),
        itemGroupId: uuid.nullable().optional(),
        reorderLevel: z.number().min(0).max(10_000_000).optional(),
        isBillable: z.boolean().optional(),
        isColdChain: z.boolean().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        drug: Drug.partial().optional(),
        uoms: z.array(UomRow).max(10).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'inventory.manage');
    return updateItem(db, callerOf(request), { itemId, ...body });
  });

  app.get('/v1/inventory/item-groups', async (request) => {
    authorize(principalOf(request), 'inventory.read');
    return { items: await listItemGroups(db, callerOf(request)) };
  });

  app.post('/v1/inventory/item-groups', async (request, reply) => {
    const body = parse(z.object({ code: Code(30), name: Name, parentId: uuid.optional() }), request.body);
    authorize(principalOf(request), 'inventory.manage');
    return reply.status(201).send(await createItemGroup(db, callerOf(request), body, idempotencyKey(request)));
  });

  // ---- suppliers (hospital-wide) --------------------------------------------------------------------------
  const SupplierFields = {
    name: Name,
    gstin: Gstin.optional(),
    stateCode: z.string().regex(/^[0-9]{2}$/).optional(),
    drugLicenceNo: z.string().trim().max(60).optional(),
    pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'a 10-character PAN').optional(),
    phone: e164.optional(),
    email: z.email().optional(),
    address: z.string().trim().max(500).optional(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
  };

  app.get('/v1/inventory/suppliers', async (request) => {
    const q = parse(z.object({ q: z.string().trim().max(100).optional() }), request.query);
    authorize(principalOf(request), 'inventory.read');
    return { items: await listSuppliers(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/suppliers', async (request, reply) => {
    const body = parse(z.object({ code: Code(20), ...SupplierFields }), request.body);
    authorize(principalOf(request), 'inventory.manage');
    return reply.status(201).send(await createSupplier(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/inventory/suppliers/:supplierId', async (request) => {
    const { supplierId } = parse(z.object({ supplierId: uuid }), request.params);
    const body = parse(z.object({ version: Version, ...SupplierFields, name: Name.optional(), status: z.enum(['active', 'blocked']).optional() }), request.body);
    authorize(principalOf(request), 'inventory.manage');
    return updateSupplier(db, callerOf(request), { supplierId, ...body });
  });

  // ---- stores -----------------------------------------------------------------------------------------------
  app.get('/v1/inventory/stores', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'inventory.read', facilityId);
    return { items: await listStores(db, callerOf(request), facilityId) };
  });

  app.post('/v1/inventory/stores', async (request, reply) => {
    const body = parse(
      z.object({
        facilityId: uuid,
        code: Code(20),
        name: Name,
        storeType: z.enum(['central', 'pharmacy', 'ward', 'theatre', 'icu', 'lab', 'emergency']),
        locationId: uuid.optional(),
        parentStoreId: uuid.optional(),
        canDispenseToPatient: z.boolean().optional(),
        drugLicenceNo: z.string().trim().min(3).max(60).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'inventory.manage', body.facilityId);
    return reply.status(201).send(await createStore(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/inventory/stores/:storeId', async (request) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    const body = parse(
      z.object({ version: Version, name: Name.optional(), parentStoreId: uuid.nullable().optional(), canDispenseToPatient: z.boolean().optional(), drugLicenceNo: z.string().trim().min(3).max(60).nullable().optional(), status: z.enum(['active', 'inactive']).optional() }),
      request.body,
    );
    await at(request, 'store', storeId, 'inventory.manage');
    return updateStore(db, callerOf(request), { storeId, ...body });
  });

  app.put('/v1/inventory/stores/:storeId/levels/:itemId', async (request) => {
    const { storeId, itemId } = parse(z.object({ storeId: uuid, itemId: uuid }), request.params);
    const body = parse(z.object({ minLevel: z.number().min(0).max(10_000_000), maxLevel: z.number().min(0).max(10_000_000).nullable().optional(), reorderQty: Qty.nullable().optional(), binLocation: z.string().trim().max(40).nullable().optional() }), request.body);
    await at(request, 'store', storeId, 'inventory.manage');
    return setStoreItemLevel(db, callerOf(request), { storeId, itemId, ...body });
  });

  app.get('/v1/inventory/stores/:storeId/stock', async (request) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    const q = parse(z.object({ q: z.string().trim().max(100).optional() }), request.query);
    await at(request, 'store', storeId, 'inventory.read');
    return { items: await storeStock(db, callerOf(request), storeId, q) };
  });

  app.get('/v1/inventory/stores/:storeId/ledger', async (request) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    const q = parse(z.object({ itemId: uuid.optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }), request.query);
    await at(request, 'store', storeId, 'inventory.read');
    return { items: await stockLedger(db, callerOf(request), { storeId, ...q }) };
  });

  app.get('/v1/inventory/low-stock', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'inventory.read', facilityId);
    return { items: await lowStock(db, callerOf(request), facilityId) };
  });

  app.get('/v1/inventory/expiring', async (request) => {
    const q = parse(z.object({ facilityId: uuid, days: z.coerce.number().int().min(0).max(365).default(90) }), request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await expiringStock(db, callerOf(request), q.facilityId, q.days) };
  });

  app.post('/v1/inventory/batches/:batchId/status', async (request) => {
    const { batchId } = parse(z.object({ batchId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['available', 'quarantined', 'recalled']), reason: Reason.optional() }), request.body);
    await at(request, 'item_batch', batchId, 'inventory.manage');
    return setBatchStatus(db, callerOf(request), { batchId, ...body });
  });

  // ---- opening stock and adjustments ----------------------------------------------------------------------
  app.post('/v1/inventory/stores/:storeId/opening', async (request, reply) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    const body = parse(z.object({ reason: Reason.optional(), lines: Lines(z.object({ ...Batch, quantity: Qty, serialNos: Serials })) }), request.body);
    await at(request, 'store', storeId, 'inventory.issue');
    return reply.status(201).send(await postOpeningStock(db, callerOf(request), { storeId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/inventory/stores/:storeId/adjustments', async (request, reply) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    const body = parse(
      z.object({ kind: z.enum(['consumption', 'damage', 'expiry_disposal', 'adjustment']), reason: Reason, departmentId: uuid.optional(), lines: Lines(z.object({ itemId: uuid, batchId: uuid.optional(), quantity: SignedQty })) }),
      request.body,
    );
    // A correction changes the books without goods leaving: it needs an approver, not just the store keeper.
    await at(request, 'store', storeId, body.kind === 'adjustment' ? 'inventory.approve' : 'inventory.issue');
    return reply.status(201).send(await adjustStock(db, callerOf(request), { storeId, ...body }, idempotencyKey(request)));
  });

  // ---- indents and transfers --------------------------------------------------------------------------------
  const ListQuery = z.object({ facilityId: uuid, storeId: uuid.optional(), status: z.string().regex(/^[a-z_]{1,30}$/).optional() });

  app.get('/v1/inventory/requisitions', async (request) => {
    const q = parse(ListQuery, request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await listRequisitions(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/requisitions', async (request, reply) => {
    const body = parse(z.object({ requestingStoreId: uuid, supplyingStoreId: uuid, note: z.string().trim().max(500).optional(), lines: Lines(z.object({ itemId: uuid, quantity: Qty })) }), request.body);
    await at(request, 'store', body.requestingStoreId, 'inventory.indent');
    return reply.status(201).send(await createRequisition(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/inventory/requisitions/:requisitionId/approve', async (request) => {
    const { requisitionId } = parse(z.object({ requisitionId: uuid }), request.params);
    const body = parse(z.object({ lines: z.array(z.object({ lineId: uuid, quantity: z.number().min(0).max(10_000_000) })).max(200).optional() }), request.body ?? {});
    await at(request, 'requisition', requisitionId, 'inventory.approve');
    return approveRequisition(db, callerOf(request), { requisitionId, ...body });
  });

  app.post('/v1/inventory/requisitions/:requisitionId/cancel', async (request) => {
    const { requisitionId } = parse(z.object({ requisitionId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    await at(request, 'requisition', requisitionId, 'inventory.indent');
    return cancelRequisition(db, callerOf(request), { requisitionId, reason });
  });

  app.get('/v1/inventory/transfers', async (request) => {
    const q = parse(ListQuery, request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await listTransfers(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/transfers', async (request, reply) => {
    const body = parse(z.object({ fromStoreId: uuid.optional(), toStoreId: uuid.optional(), requisitionId: uuid.optional(), lines: Lines(z.object({ itemId: uuid, quantity: Qty })) }), request.body);
    if (body.requisitionId) await at(request, 'requisition', body.requisitionId, 'inventory.issue');
    else if (body.fromStoreId) await at(request, 'store', body.fromStoreId, 'inventory.issue');
    else throw new DomainError('validation', 'name the sending store or the indent', { reason: 'stores_required' });
    return reply.status(201).send(await dispatchTransfer(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/inventory/transfers/:transferId/receive', async (request) => {
    const { transferId } = parse(z.object({ transferId: uuid }), request.params);
    const body = parse(z.object({ lines: z.array(z.object({ lineId: uuid, quantity: z.number().min(0).max(10_000_000), reason: Reason.optional() })).max(500).optional() }), request.body ?? {});
    await at(request, 'stock_transfer', transferId, 'inventory.receive');
    return receiveTransfer(db, callerOf(request), { transferId, ...body });
  });

  // ---- stock counts -----------------------------------------------------------------------------------------
  app.get('/v1/inventory/counts', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'inventory.read', facilityId);
    return { items: await listStockCounts(db, callerOf(request), { facilityId }) };
  });

  app.get('/v1/inventory/counts/:stockCountId', async (request) => {
    const { stockCountId } = parse(z.object({ stockCountId: uuid }), request.params);
    await at(request, 'stock_count', stockCountId, 'inventory.read');
    return getStockCount(db, callerOf(request), stockCountId);
  });

  app.post('/v1/inventory/stores/:storeId/counts', async (request, reply) => {
    const { storeId } = parse(z.object({ storeId: uuid }), request.params);
    await at(request, 'store', storeId, 'inventory.count');
    return reply.status(201).send(await openStockCount(db, callerOf(request), { storeId }, idempotencyKey(request)));
  });

  app.post('/v1/inventory/counts/:stockCountId/record', async (request) => {
    const { stockCountId } = parse(z.object({ stockCountId: uuid }), request.params);
    const body = parse(z.object({ lines: z.array(z.object({ lineId: uuid.optional(), batchId: uuid.optional(), countedQty: z.number().min(0).max(10_000_000).multipleOf(0.001), note: z.string().trim().max(300).optional() })).min(1).max(2000) }), request.body);
    await at(request, 'stock_count', stockCountId, 'inventory.count');
    return recordStockCount(db, callerOf(request), { stockCountId, ...body });
  });

  app.post('/v1/inventory/counts/:stockCountId/submit', async (request) => {
    const { stockCountId } = parse(z.object({ stockCountId: uuid }), request.params);
    await at(request, 'stock_count', stockCountId, 'inventory.count');
    return submitStockCount(db, callerOf(request), { stockCountId });
  });

  app.post('/v1/inventory/counts/:stockCountId/approve', async (request) => {
    const { stockCountId } = parse(z.object({ stockCountId: uuid }), request.params);
    const body = parse(z.object({ reject: z.boolean().optional() }), request.body ?? {});
    await at(request, 'stock_count', stockCountId, 'inventory.approve');
    return approveStockCount(db, callerOf(request), { stockCountId, ...body });
  });

  // ---- purchasing -------------------------------------------------------------------------------------------
  app.get('/v1/inventory/purchase-orders', async (request) => {
    const q = parse(z.object({ facilityId: uuid, status: z.enum(['draft', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled']).optional() }), request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await listPurchaseOrders(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/purchase-orders', async (request, reply) => {
    const body = parse(
      z.object({
        storeId: uuid,
        supplierId: uuid,
        expectedOn: isoDate.optional(),
        notes: z.string().trim().max(1000).optional(),
        lines: Lines(z.object({ itemId: uuid, uom: Uom.optional(), quantity: Qty, freeQty: z.number().min(0).max(10_000_000).optional(), unitPriceMinor: Minor, gstRateBp: z.union([z.literal(0), z.literal(500), z.literal(1200), z.literal(1800), z.literal(2800)]) })),
      }),
      request.body,
    );
    await at(request, 'store', body.storeId, 'inventory.purchase');
    return reply.status(201).send(await createPurchaseOrder(db, callerOf(request), body, idempotencyKey(request)));
  });

  for (const action of ['approve', 'send', 'cancel', 'close'] as const) {
    app.post(`/v1/inventory/purchase-orders/:purchaseOrderId/${action}`, async (request) => {
      const { purchaseOrderId } = parse(z.object({ purchaseOrderId: uuid }), request.params);
      const body = parse(z.object({ reason: Reason.optional() }), request.body ?? {});
      await at(request, 'purchase_order', purchaseOrderId, action === 'approve' ? 'inventory.approve' : 'inventory.purchase');
      return movePurchaseOrder(db, callerOf(request), { purchaseOrderId, action, ...body });
    });
  }

  app.get('/v1/inventory/goods-receipts', async (request) => {
    const q = parse(z.object({ facilityId: uuid, uninvoiced: z.coerce.boolean().optional(), supplierId: uuid.optional() }), request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await listGoodsReceipts(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/goods-receipts', async (request, reply) => {
    const body = parse(
      z.object({
        storeId: uuid,
        supplierId: uuid.optional(),
        purchaseOrderId: uuid.optional(),
        supplierInvoiceRef: z.string().trim().max(40).optional(),
        lines: Lines(
          z.object({
            ...Batch,
            purchaseOrderLineId: uuid.optional(),
            qtyReceived: z.number().min(0).max(10_000_000).multipleOf(0.001),
            qtyFree: z.number().min(0).max(10_000_000).multipleOf(0.001).optional(),
            qtyRejected: z.number().min(0).max(10_000_000).multipleOf(0.001).optional(),
            rejectReason: Reason.optional(),
            serialNos: Serials,
          }),
        ),
      }),
      request.body,
    );
    await at(request, 'store', body.storeId, 'inventory.receive');
    return reply.status(201).send(await receiveGoods(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.get('/v1/inventory/supplier-invoices', async (request) => {
    const q = parse(z.object({ facilityId: uuid, status: z.enum(['recorded', 'approved', 'paid']).optional() }), request.query);
    authorize(principalOf(request), 'inventory.read', q.facilityId);
    return { items: await listSupplierInvoices(db, callerOf(request), q) };
  });

  app.post('/v1/inventory/supplier-invoices', async (request, reply) => {
    const body = parse(
      z.object({
        supplierId: uuid,
        invoiceNo: z.string().trim().min(1).max(40),
        invoiceDate: isoDate,
        dueOn: isoDate.optional(),
        taxableMinor: Minor,
        cgstMinor: Minor.optional(),
        sgstMinor: Minor.optional(),
        igstMinor: Minor.optional(),
        roundOffMinor: z.number().int().min(-100).max(100).optional(),
        totalMinor: Minor,
        goodsReceiptIds: z.array(uuid).min(1).max(50),
      }),
      request.body,
    );
    const facilities = await receiptFacilities(db, callerOf(request), body.goodsReceiptIds);
    if (!facilities.length) throw new DomainError('not_found', 'goods receipt not found');
    authorizeEvery(principalOf(request), 'inventory.purchase', facilities);
    return reply.status(201).send(await recordSupplierInvoice(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/inventory/supplier-invoices/:supplierInvoiceId/approve', async (request) => {
    const { supplierInvoiceId } = parse(z.object({ supplierInvoiceId: uuid }), request.params);
    const body = parse(z.object({ reason: Reason.optional() }), request.body ?? {});
    const facilities = await invoiceFacilities(db, callerOf(request), supplierInvoiceId);
    if (!facilities.length) throw new DomainError('not_found', 'supplier invoice not found');
    authorizeEvery(principalOf(request), 'inventory.approve', facilities);
    return approveSupplierInvoice(db, callerOf(request), { supplierInvoiceId, ...body });
  });

  app.post('/v1/inventory/purchase-returns', async (request, reply) => {
    const body = parse(
      z.object({ storeId: uuid, supplierId: uuid, reason: z.enum(['expired', 'damaged', 'recalled', 'excess']), debitNoteRef: z.string().trim().max(40).optional(), lines: Lines(z.object({ batchId: uuid, quantity: Qty })) }),
      request.body,
    );
    await at(request, 'store', body.storeId, 'inventory.purchase');
    return reply.status(201).send(await returnToVendor(db, callerOf(request), body, idempotencyKey(request)));
  });
}
