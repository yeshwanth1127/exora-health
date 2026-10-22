import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import {
  adjustStock, createItem, createStore, createSupplier, itemLedger, listItems, listReceipts, listStores, listSuppliers, receiveGoods, setBatchStatus,
  stockAlerts, storeFacility, storeStock, updateItem,
} from '../../modules/inventory/index.ts';
import { moduleRoutes } from '../module-routes.ts';
import { callerOf, idempotencyKey, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_./-]{1,40}$/, 'letters, digits and _ . / - (up to 40)');
const ShortCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/, 'letters, digits, - and _ (up to 20)');
const Name = z.string().trim().min(1).max(200);
const Uom = z.string().trim().toLowerCase().regex(/^[a-z_]{1,20}$/);
const Qty = z.number().positive().max(10_000_000);
const Minor = z.number().int().min(0).max(10_000_000_00);
const Limit = z.coerce.number().int().min(1).max(500).default(100);
const Reason = z.string().trim().min(3).max(500);

const Drug = z.object({
  genericName: Name, brandName: Name.optional(), strength: z.string().trim().max(50).optional(),
  dosageForm: z.enum(['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'infusion', 'ointment', 'cream', 'drops', 'inhaler', 'suppository', 'powder', 'patch', 'other']),
  defaultRoute: z.enum(['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'vaginal', 'other']).optional(),
  manufacturer: Name.optional(), regulatorySchedule: z.enum(['none', 'G', 'H', 'H1', 'X']).default('none'), isNdps: z.boolean().default(false), isHighAlert: z.boolean().default(false),
});

export function registerInventoryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  const atStore = async (request: FastifyRequest, storeId: string, permission: string) => {
    const facilityId = await storeFacility(db, callerOf(request), storeId);
    if (!facilityId) throw new DomainError('not_found', 'store not found');
    authorize(principalOf(request), permission, facilityId);
  };

  moduleRoutes(app, db, 'inventory', (r) => {
    r.get('/v1/inventory/stores', async (request) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
      authorize(principalOf(request), 'inventory.read', facilityId);
      return { items: await listStores(db, callerOf(request), facilityId) };
    });
    r.post('/v1/inventory/stores', async (request, reply) => {
      const body = parse(z.object({ facilityId: uuid, code: ShortCode, name: Name, drugLicenceNo: z.string().trim().min(3).max(60) }), request.body);
      authorize(principalOf(request), 'inventory.manage', body.facilityId);
      return reply.status(201).send(await createStore(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.get('/v1/inventory/items', async (request) => {
      const q = parse(z.object({ search: z.string().trim().min(1).max(100).optional(), itemType: z.enum(['drug', 'consumable', 'vaccine', 'general']).optional(), storeId: uuid.optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'inventory.read');
      return { items: await listItems(db, callerOf(request), q) };
    });
    r.post('/v1/inventory/items', async (request, reply) => {
      const body = parse(z.object({
        code: Code, name: Name, itemType: z.enum(['drug', 'consumable', 'vaccine', 'general']), baseUom: Uom, packUom: Uom.optional(), packSize: Qty.optional(),
        hsnCode: z.string().regex(/^[0-9]{4,8}$/).optional(), isExpiryTracked: z.boolean().default(true), reorderLevel: z.number().min(0).default(0), drug: Drug.optional(),
      }), request.body);
      authorize(principalOf(request), 'inventory.manage', null);
      return reply.status(201).send(await createItem(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.patch('/v1/inventory/items/:itemId', async (request) => {
      const { itemId } = parse(z.object({ itemId: uuid }), request.params);
      const body = parse(z.object({ version: z.number().int().min(1), name: Name.optional(), reorderLevel: z.number().min(0).optional(), hsnCode: z.string().regex(/^[0-9]{4,8}$/).nullable().optional(), status: z.enum(['active', 'inactive']).optional() }), request.body);
      authorize(principalOf(request), 'inventory.manage', null);
      return updateItem(db, callerOf(request), { itemId, ...body }, optionalIdempotencyKey(request));
    });

    r.get('/v1/inventory/suppliers', async (request) => {
      authorize(principalOf(request), 'inventory.read');
      return { items: await listSuppliers(db, callerOf(request)) };
    });
    r.post('/v1/inventory/suppliers', async (request, reply) => {
      const body = parse(z.object({
        code: ShortCode, name: Name, gstin: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/).optional(),
        drugLicenceNo: z.string().trim().max(60).optional(), phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/).optional(), email: z.email().optional(),
        address: z.string().trim().max(500).optional(), paymentTermsDays: z.number().int().min(0).max(365).optional(),
      }), request.body);
      authorize(principalOf(request), 'inventory.manage', null);
      return reply.status(201).send(await createSupplier(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.get('/v1/inventory/stock', async (request) => {
      const q = parse(z.object({ storeId: uuid, itemId: uuid.optional(), includeEmpty: z.enum(['true', 'false']).optional() }), request.query);
      await atStore(request, q.storeId, 'inventory.read');
      return { items: await storeStock(db, callerOf(request), { ...q, includeEmpty: q.includeEmpty === 'true' }) };
    });
    r.get('/v1/inventory/alerts', async (request) => {
      const q = parse(z.object({ storeId: uuid, days: z.coerce.number().int().min(1).max(365).default(90) }), request.query);
      await atStore(request, q.storeId, 'inventory.read');
      return stockAlerts(db, callerOf(request), q);
    });
    r.get('/v1/inventory/ledger', async (request) => {
      const q = parse(z.object({ storeId: uuid, itemId: uuid, limit: Limit }), request.query);
      await atStore(request, q.storeId, 'inventory.read');
      return { items: await itemLedger(db, callerOf(request), q) };
    });

    r.get('/v1/inventory/receipts', async (request) => {
      const q = parse(z.object({ storeId: uuid, limit: Limit }), request.query);
      await atStore(request, q.storeId, 'inventory.read');
      return { items: await listReceipts(db, callerOf(request), q) };
    });
    r.post('/v1/inventory/receipts', async (request, reply) => {
      const body = parse(z.object({
        storeId: uuid, supplierId: uuid, supplierInvoiceNo: z.string().trim().min(1).max(40), supplierInvoiceOn: isoDate, invoiceTotalMinor: Minor.optional(),
        notes: z.string().trim().max(1000).optional(),
        lines: z.array(z.object({
          itemId: uuid, batchNo: z.string().trim().min(1).max(40), expiryDate: isoDate.optional(), mrpMinor: Minor.optional(), unitCostMinor: Minor,
          qtyReceived: z.number().min(0).max(10_000_000), qtyFree: z.number().min(0).max(10_000_000).optional(), gstRateBp: z.number().int().min(0).max(10000).optional(),
        })).min(1).max(200),
      }), request.body);
      await atStore(request, body.storeId, 'inventory.receive');
      return reply.status(201).send(await receiveGoods(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/inventory/adjustments', async (request, reply) => {
      const body = parse(z.object({
        storeId: uuid, kind: z.enum(['opening', 'consumption', 'adjustment', 'expiry_disposal', 'damage', 'vendor_return']), reason: Reason, supplierId: uuid.optional(),
        lines: z.array(z.object({
          itemBatchId: uuid.optional(), quantity: z.number().refine((n) => n !== 0, 'quantity cannot be zero'),
          opening: z.object({ itemId: uuid, batchNo: z.string().trim().min(1).max(40), expiryDate: isoDate.optional(), mrpMinor: Minor.optional(), unitCostMinor: Minor }).optional(),
        })).min(1).max(200),
      }), request.body);
      await atStore(request, body.storeId, body.kind === 'opening' ? 'inventory.receive' : 'inventory.adjust');
      return reply.status(201).send(await adjustStock(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/inventory/batches/:itemBatchId/status', async (request) => {
      const { itemBatchId } = parse(z.object({ itemBatchId: uuid }), request.params);
      const body = parse(z.object({ status: z.enum(['available', 'quarantined', 'recalled', 'expired']), reason: Reason.optional(), version: z.number().int().min(1) }), request.body);
      authorize(principalOf(request), 'inventory.manage', null);
      return setBatchStatus(db, callerOf(request), { itemBatchId, ...body }, optionalIdempotencyKey(request));
    });
  });
}
