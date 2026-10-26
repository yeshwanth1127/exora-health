// Charges: what a patient owes for. Consultations are charged by the worker when the patient checks in
// (the fee booked on the appointment); staff post manual charges; pharmacy and bed days come with their
// modules. A charge is posted once per source and service date (unique index), so a redelivered event is
// a no-op. Until it is invoiced a charge can be discounted or reversed; afterwards only a credit note
// takes money back.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, writeAudit, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { inclusiveLineAmounts, lineAmounts, localDay, resolveTax } from './tax.ts';

export interface ChargeInput {
  facilityId: string;
  patientId: string | null;
  encounterId?: string | null | undefined;
  sourceType: 'consultation' | 'dispense_line' | 'bed_day' | 'procedure' | 'manual';
  sourceId: string | null;
  appointmentId?: string | null | undefined;
  dispenseLineId?: string | null | undefined;
  bedOccupancyId?: string | null | undefined;
  billingAccountId?: string | null | undefined;
  serviceDate: string;
  serviceItemId?: string | null | undefined;
  itemId?: string | null | undefined;
  priceListItemId?: string | null | undefined;
  description: string;
  hsnSacCode?: string | null | undefined;
  serviceCategory?: string | null | undefined;
  itemType?: string | null | undefined;
  encounterClass?: string | null | undefined;
  quantity: number;
  unitPriceMinor: number;
  /** The price already includes GST (MRP-priced medicines). */
  taxInclusive?: boolean | undefined;
  postedBy: string | null;
}

/**
 * Prices, taxes and inserts a charge in the caller's transaction (mod_billing). Returns null when the
 * source was already charged for that date.
 */
export async function postCharge(tx: Transaction<DB>, tenantId: string, c: ChargeInput): Promise<{ chargeId: string; netMinor: number } | null> {
  const tax = await resolveTax(tx, {
    hsnSacCode: c.hsnSacCode, serviceCategory: c.serviceCategory, itemType: c.itemType, encounterClass: c.encounterClass,
    unitPriceMinor: c.unitPriceMinor, on: c.serviceDate,
  });
  const a = (c.taxInclusive ? inclusiveLineAmounts : lineAmounts)(c.quantity, c.unitPriceMinor, 0, tax.gstRateBp);
  const row = await tx
    .insertInto('billing.charge')
    .values({
      tenant_id: tenantId,
      facility_id: c.facilityId,
      patient_id: c.patientId,
      encounter_id: c.encounterId ?? null,
      billing_account_id: c.billingAccountId ?? null,
      source_type: c.sourceType,
      source_id: c.sourceId,
      appointment_id: c.appointmentId ?? null,
      dispense_line_id: c.dispenseLineId ?? null,
      bed_occupancy_id: c.bedOccupancyId ?? null,
      service_date: c.serviceDate,
      service_item_id: c.serviceItemId ?? null,
      item_id: c.itemId ?? null,
      price_list_item_id: c.priceListItemId ?? null,
      description: c.description.slice(0, 300),
      hsn_sac_code: c.hsnSacCode ?? null,
      quantity: c.quantity,
      unit_price_minor: c.unitPriceMinor,
      gross_minor: a.grossMinor,
      discount_minor: a.discountMinor,
      taxable_minor: a.taxableMinor,
      tax_rule_id: tax.taxRuleId,
      is_tax_exempt: tax.exempt,
      is_tax_inclusive: c.taxInclusive ?? false,
      gst_rate_bp: tax.gstRateBp,
      cgst_minor: a.cgstMinor,
      sgst_minor: a.sgstMinor,
      igst_minor: 0,
      net_minor: a.netMinor,
      posted_by: c.postedBy,
      created_by: c.postedBy,
    })
    .onConflict((oc) =>
      oc.columns(['tenant_id', 'source_type', 'source_id', 'service_date']).where('status', '<>', 'reversed').where('source_id', 'is not', null).doNothing(),
    )
    .returning(['id', 'net_minor'])
    .executeTakeFirst();
  return row ? { chargeId: row.id, netMinor: row.net_minor } : null;
}

/** Consumer: a checked-in appointment with a booked fee is charged once (consultation, clinic-local date). */
export async function chargeConsultation(tx: Transaction<DB>, tenantId: string, appointmentId: string, correlationId: string | null) {
  const { rows: [a] } = await sql<{
    patient_id: string | null; facility_id: string; fee_snapshot_minor: number | null; price_list_item_id: string | null;
    checked_in_at: Date | null; timezone: string; doctor: string; service_item_id: string | null; service_name: string | null;
    sac_code: string | null; visit_mode: string; encounter_id: string | null;
  }>`
    SELECT a.patient_id, a.facility_id, a.fee_snapshot_minor, a.price_list_item_id, a.checked_in_at, f.timezone,
           s.display_name AS doctor, si.id AS service_item_id, si.name AS service_name, si.sac_code, a.visit_mode, e.id AS encounter_id
    FROM booking.appointment a
    JOIN platform.facility f ON f.id = a.facility_id
    JOIN platform.staff s ON s.id = a.practitioner_staff_id
    LEFT JOIN catalog.price_list_item pli ON pli.id = a.price_list_item_id
    LEFT JOIN catalog.service_item si ON si.id = pli.service_item_id
    LEFT JOIN clinical.encounter e ON e.appointment_id = a.id
    WHERE a.id = ${appointmentId}`.execute(tx);
  // No fee booked (free follow-up, or no price configured) or no registered patient: nothing to charge.
  if (!a || !a.patient_id || !a.fee_snapshot_minor) return;
  const posted = await postCharge(tx, tenantId, {
    facilityId: a.facility_id,
    patientId: a.patient_id,
    encounterId: a.encounter_id,
    sourceType: 'consultation',
    sourceId: appointmentId,
    appointmentId,
    serviceDate: localDay(a.checked_in_at ?? new Date(), a.timezone),
    serviceItemId: a.service_item_id,
    priceListItemId: a.price_list_item_id,
    description: `${a.service_name ?? 'Consultation'} — ${a.doctor}`,
    hsnSacCode: a.sac_code,
    serviceCategory: 'consultation',
    encounterClass: a.visit_mode === 'virtual' ? 'virtual' : 'outpatient',
    quantity: 1,
    unitPriceMinor: a.fee_snapshot_minor,
    postedBy: null,
  });
  if (posted) {
    await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [
      { action: 'create', subjectType: 'billing.charge', subjectId: posted.chargeId, patientId: a.patient_id, diff: { sourceType: 'consultation', appointmentId, netMinor: posted.netMinor } },
    ]);
  }
}

/**
 * Consumer: a cancelled appointment's consultation charge is reversed while it is not yet invoiced. An
 * invoiced one is left for staff (credit note and refund are their decision).
 */
export async function reverseConsultation(tx: Transaction<DB>, tenantId: string, appointmentId: string, reason: string, correlationId: string | null) {
  const charge = await tx
    .selectFrom('billing.charge')
    .select(['id', 'patient_id'])
    .where('source_type', '=', 'consultation')
    .where('source_id', '=', appointmentId)
    .where('status', '=', 'posted')
    .forUpdate()
    .executeTakeFirst();
  if (!charge) return;
  if (await onLiveInvoice(tx, charge.id)) return;
  await tx.updateTable('billing.charge').set({ status: 'reversed', reversed_at: sql`now()`, reverse_reason: `appointment cancelled: ${reason}`.slice(0, 500) }).where('id', '=', charge.id).execute();
  await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [
    { action: 'status_change', subjectType: 'billing.charge', subjectId: charge.id, patientId: charge.patient_id, reason, diff: { status: ['posted', 'reversed'] } },
  ]);
}

async function onLiveInvoice(tx: Transaction<DB>, chargeId: string) {
  return !!(await tx.selectFrom('billing.invoice_line').select('id').where('charge_id', '=', chargeId).where('released_at', 'is', null).executeTakeFirst());
}

/** The facility's price for a service from the active default price list on a date (doctor-agnostic). */
async function servicePrice(tx: Transaction<DB>, serviceItemId: string, on: string) {
  const { rows: [p] } = await sql<{ id: string; unit_price_minor: number }>`
    SELECT pli.id, pli.unit_price_minor FROM catalog.price_list_item pli
    JOIN catalog.price_list pl ON pl.id = pli.price_list_id AND pl.status = 'active' AND pl.is_default
    WHERE pli.service_item_id = ${serviceItemId} AND pli.staff_id IS NULL AND pli.bed_category_id IS NULL
      AND pli.valid_from <= ${on}::date AND (pli.valid_to IS NULL OR pli.valid_to > ${on}::date)
    ORDER BY pli.encounter_class NULLS LAST LIMIT 1`.execute(tx);
  return p ?? null;
}

export interface ManualChargeInput {
  facilityId: string;
  patientId: string;
  encounterId?: string | undefined;
  serviceItemId?: string | undefined;
  description?: string | undefined;
  quantity: number;
  /** Required unless the service has a price on the active price list. */
  unitPriceMinor?: number | undefined;
  serviceDate?: string | undefined;
}

/** Staff post a charge for something done at the clinic (a dressing, a procedure, a certificate…). */
export async function postManualCharge(db: Kysely<DB>, caller: Caller, input: ManualChargeInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.post_manual_charge', idempotencyKey, request: input }, async (ctx) => {
    const facility = await ctx.tx.selectFrom('platform.facility').select(['timezone']).where('id', '=', input.facilityId).executeTakeFirst();
    if (!facility) throw notFound('facility', { facilityId: input.facilityId });
    const patient = await ctx.tx.selectFrom('patient.patient').select('id').where('id', '=', input.patientId).executeTakeFirst();
    if (!patient) throw notFound('patient', { patientId: input.patientId });
    if (input.encounterId) {
      const e = await ctx.tx.selectFrom('clinical.encounter').select(['patient_id', 'facility_id']).where('id', '=', input.encounterId).executeTakeFirst();
      if (!e || e.patient_id !== input.patientId || e.facility_id !== input.facilityId) throw invalid('the encounter is not this patient’s visit at this clinic', { reason: 'encounter_mismatch' });
    }
    const serviceDate = input.serviceDate ?? localDay(now, facility.timezone);
    let service: { name: string; sac_code: string | null; category: string; is_billable: boolean } | undefined;
    let price: { id: string; unit_price_minor: number } | null = null;
    if (input.serviceItemId) {
      service = await ctx.tx.selectFrom('catalog.service_item').select(['name', 'sac_code', 'category', 'is_billable']).where('id', '=', input.serviceItemId).executeTakeFirst();
      if (!service) throw notFound('service', { serviceItemId: input.serviceItemId });
      if (!service.is_billable) throw invalid('this service is not billable', { reason: 'not_billable' });
      price = await servicePrice(ctx.tx, input.serviceItemId, serviceDate);
    }
    const unitPriceMinor = input.unitPriceMinor ?? price?.unit_price_minor;
    if (unitPriceMinor === undefined) throw invalid('give a price: this service has no price on the active price list', { reason: 'price_required' });
    const description = input.description ?? service?.name;
    if (!description) throw invalid('describe the charge or choose a service', { reason: 'description_required' });
    const posted = await postCharge(ctx.tx, ctx.tenantId, {
      facilityId: input.facilityId,
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      sourceType: 'manual',
      sourceId: null,
      serviceDate,
      serviceItemId: input.serviceItemId ?? null,
      // A typed price that differs from the list is a manual price, not the list's.
      priceListItemId: price && price.unit_price_minor === unitPriceMinor ? price.id : null,
      description,
      hsnSacCode: service?.sac_code ?? null,
      serviceCategory: service?.category ?? null,
      quantity: input.quantity,
      unitPriceMinor,
      postedBy: ctx.actor.staffId ?? null,
    });
    ctx.audit({ action: 'create', subjectType: 'billing.charge', subjectId: posted!.chargeId, patientId: input.patientId, diff: { sourceType: 'manual', description, quantity: input.quantity, unitPriceMinor } });
    return { chargeId: posted!.chargeId, netMinor: posted!.netMinor };
  });
}

/** Takes back a not-yet-invoiced charge (wrong patient, not done…). Remove it from a draft bill first. */
export async function reverseCharge(db: Kysely<DB>, caller: Caller, input: { chargeId: string; reason: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.reverse_charge', idempotencyKey, request: input }, async (ctx) => {
    const c = await ctx.tx.selectFrom('billing.charge').selectAll().where('id', '=', input.chargeId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('charge', { chargeId: input.chargeId });
    if (c.version !== input.version) throw conflict('this charge was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: c.version });
    if (c.status !== 'posted') throw preconditionFailed(`charge is ${c.status}; use a credit note for billed charges`, { reason: 'charge_not_open', status: c.status });
    if (await onLiveInvoice(ctx.tx, c.id)) throw preconditionFailed('the charge is on a draft bill; void or rebuild that bill first', { reason: 'on_draft_invoice' });
    const { version } = await ctx.tx.updateTable('billing.charge')
      .set({ status: 'reversed', reversed_at: now, reversed_by: ctx.actor.staffId ?? null, reverse_reason: input.reason, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', c.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.charge', subjectId: c.id, patientId: c.patient_id, reason: input.reason, diff: { status: ['posted', 'reversed'] } });
    return { chargeId: c.id, status: 'reversed' as const, version };
  });
}

/** Applies an approved discount to an open charge, retaxing it at its own rate. */
async function applyDiscount(ctx: CommandContext, chargeId: string, amountMinor: number) {
  const c = await ctx.tx.selectFrom('billing.charge').selectAll().where('id', '=', chargeId).forUpdate().executeTakeFirstOrThrow();
  if (c.status !== 'posted') throw preconditionFailed(`charge is ${c.status}; discounts apply before billing`, { reason: 'charge_not_open', status: c.status });
  // Discounts are asked for in what the patient pays; a tax-inclusive line stores its discount ex-tax.
  const already = c.is_tax_inclusive ? Math.round((c.discount_minor * (10_000 + c.gst_rate_bp)) / 10_000) : c.discount_minor;
  const discount = already + amountMinor;
  const ceiling = c.is_tax_inclusive ? Math.round(Number(c.quantity) * c.unit_price_minor) : c.gross_minor;
  if (discount > ceiling) throw invalid('the discount is more than the charge', { reason: 'discount_exceeds_charge', grossMinor: ceiling, discountMinor: already });
  const a = (c.is_tax_inclusive ? inclusiveLineAmounts : lineAmounts)(Number(c.quantity), c.unit_price_minor, discount, c.gst_rate_bp);
  await ctx.tx.updateTable('billing.charge')
    .set({ discount_minor: a.discountMinor, taxable_minor: a.taxableMinor, cgst_minor: a.cgstMinor, sgst_minor: a.sgstMinor, net_minor: a.netMinor, updated_by: ctx.actor.staffId ?? null })
    .where('id', '=', c.id).execute();
  return { patientId: c.patient_id, netMinor: a.netMinor };
}

/** The highest discount percentage any of the staff member's roles allows at the facility without approval. */
async function discountLimitPercent(tx: Transaction<DB>, staffId: string, facilityId: string): Promise<number> {
  const { rows: [r] } = await sql<{ pct: number | null }>`
    SELECT max((r.settings->>'max_discount_percent')::numeric)::float AS pct
    FROM platform.role_grant g JOIN platform.role r ON r.id = g.role_id AND r.status = 'active'
    WHERE g.staff_id = ${staffId} AND g.revoked_at IS NULL AND (g.facility_id IS NULL OR g.facility_id = ${facilityId})
      AND g.valid_from <= now() AND (g.valid_to IS NULL OR g.valid_to > now())`.execute(tx);
  return r?.pct ?? 0;
}

/**
 * A discount on an open charge. Within the requester's role limit — or when the requester may approve —
 * it applies at once; otherwise it waits for approval.
 */
export async function requestDiscount(
  db: Kysely<DB>, caller: Caller, input: { chargeId: string; amountMinor: number; reason: string; canApprove: boolean }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.request_discount', idempotencyKey, request: input }, async (ctx) => {
    const c = await ctx.tx.selectFrom('billing.charge').select(['id', 'facility_id', 'gross_minor', 'discount_minor', 'status', 'patient_id']).where('id', '=', input.chargeId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('charge', { chargeId: input.chargeId });
    if (c.status !== 'posted') throw preconditionFailed(`charge is ${c.status}; discounts apply before billing`, { reason: 'charge_not_open', status: c.status });
    if (await onLiveInvoice(ctx.tx, c.id)) throw preconditionFailed('the charge is on a draft bill; void or rebuild that bill first', { reason: 'on_draft_invoice' });
    const staffId = ctx.actor.staffId!;
    const percent = ((c.discount_minor + input.amountMinor) * 100) / Math.max(c.gross_minor, 1);
    const approveNow = input.canApprove || percent <= (await discountLimitPercent(ctx.tx, staffId, c.facility_id));
    let adjustmentId: string;
    try {
      adjustmentId = (await ctx.tx.insertInto('billing.charge_adjustment').values({
        tenant_id: ctx.tenantId, charge_id: c.id, amount_minor: input.amountMinor, reason: input.reason, requested_by: staffId, created_by: staffId,
        status: approveNow ? 'approved' : 'pending', decided_by: approveNow ? staffId : null, decided_at: approveNow ? sql`now()` : null,
      }).returning('id').executeTakeFirstOrThrow()).id;
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('a discount for this charge is already waiting for approval', { reason: 'discount_pending' });
      throw err;
    }
    const applied = approveNow ? await applyDiscount(ctx, c.id, input.amountMinor) : null;
    ctx.audit({ action: 'create', subjectType: 'billing.charge_adjustment', subjectId: adjustmentId, patientId: c.patient_id, reason: input.reason, diff: { chargeId: c.id, amountMinor: input.amountMinor, status: approveNow ? 'approved' : 'pending' } });
    return { adjustmentId, status: approveNow ? 'approved' as const : 'pending' as const, chargeNetMinor: applied?.netMinor ?? null };
  });
}

/** Someone with billing.approve approves or rejects a pending discount. */
export async function decideDiscount(
  db: Kysely<DB>, caller: Caller, input: { adjustmentId: string; decision: 'approved' | 'rejected'; note?: string | undefined; version: number }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.decide_discount', idempotencyKey, request: input }, async (ctx) => {
    const adj = await ctx.tx.selectFrom('billing.charge_adjustment').selectAll().where('id', '=', input.adjustmentId).forUpdate().executeTakeFirst();
    if (!adj) throw notFound('discount request', { adjustmentId: input.adjustmentId });
    if (adj.version !== input.version) throw conflict('this request was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: adj.version });
    if (adj.status !== 'pending') throw preconditionFailed(`discount request is ${adj.status}`, { reason: 'not_pending', status: adj.status });
    const applied = input.decision === 'approved' ? await applyDiscount(ctx, adj.charge_id, adj.amount_minor) : null;
    const { version } = await ctx.tx.updateTable('billing.charge_adjustment')
      .set({ status: input.decision, decided_by: ctx.actor.staffId ?? null, decided_at: sql`now()`, decision_note: input.note ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', adj.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.charge_adjustment', subjectId: adj.id, patientId: applied?.patientId ?? null, reason: input.note, diff: { status: ['pending', input.decision] } });
    return { adjustmentId: adj.id, status: input.decision, version, chargeNetMinor: applied?.netMinor ?? null };
  });
}

/**
 * Consumer: every line of a completed dispense is charged (GST by the item's HSN code). Ward indents and
 * prescriptions from an inpatient stay go on the stay's account; counter sales may have no patient.
 */
export async function chargeDispense(tx: Transaction<DB>, tenantId: string, dispenseId: string, correlationId: string | null) {
  const { rows } = await sql<{
    line_id: string; facility_id: string; patient_id: string | null; encounter_id: string | null; dispensed_at: Date; timezone: string; item_id: string;
    item_name: string; hsn_code: string | null; item_type: string; batch_no: string; quantity: string; unit_price_minor: number; price_list_item_id: string | null;
    is_billable: boolean; account_id: string | null; encounter_class: string | null;
  }>`
    SELECT l.id AS line_id, d.facility_id, d.patient_id, d.encounter_id, d.dispensed_at, f.timezone, l.item_id, i.name AS item_name, i.hsn_code, i.item_type,
           ib.batch_no, l.quantity, l.unit_price_minor, l.price_list_item_id, i.is_billable, ba.id AS account_id, e.encounter_class
    FROM pharmacy.dispense_line l
    JOIN pharmacy.dispense d ON d.id = l.dispense_id
    JOIN platform.facility f ON f.id = d.facility_id
    JOIN inventory.item i ON i.id = l.item_id
    JOIN inventory.item_batch ib ON ib.id = l.item_batch_id
    LEFT JOIN clinical.encounter e ON e.id = d.encounter_id
    LEFT JOIN billing.billing_account ba ON ba.admission_id = e.admission_id AND ba.status = 'open'
    WHERE l.dispense_id = ${dispenseId} ORDER BY l.created_at`.execute(tx);
  const audits = [];
  for (const r of rows) {
    if (!r.is_billable) continue;
    const posted = await postCharge(tx, tenantId, {
      facilityId: r.facility_id, patientId: r.patient_id, encounterId: r.encounter_id, billingAccountId: r.account_id,
      sourceType: 'dispense_line', sourceId: r.line_id, dispenseLineId: r.line_id, serviceDate: localDay(new Date(r.dispensed_at), r.timezone),
      itemId: r.item_id, priceListItemId: r.price_list_item_id, description: `${r.item_name} (batch ${r.batch_no})`, hsnSacCode: r.hsn_code,
      itemType: r.item_type, encounterClass: r.encounter_class, quantity: Number(r.quantity), unitPriceMinor: r.unit_price_minor, taxInclusive: true, postedBy: null,
    });
    if (posted) audits.push({ action: 'create' as const, subjectType: 'billing.charge', subjectId: posted.chargeId, patientId: r.patient_id, diff: { sourceType: 'dispense_line', dispenseLineId: r.line_id, netMinor: posted.netMinor } });
  }
  await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, audits);
}

/**
 * Consumer: a return takes the returned quantity off the line's charge while it is unbilled (the charge is
 * reversed and the remainder re-posted). A billed charge is left for a credit note.
 */
export async function rechargeAfterReturn(tx: Transaction<DB>, tenantId: string, dispenseLineId: string, correlationId: string | null) {
  const charge = await tx.selectFrom('billing.charge').selectAll().where('source_type', '=', 'dispense_line').where('source_id', '=', dispenseLineId)
    .where('status', '=', 'posted').forUpdate().executeTakeFirst();
  if (!charge || (await onLiveInvoice(tx, charge.id))) return;
  const line = await tx.selectFrom('pharmacy.dispense_line').select(['quantity', 'returned_qty']).where('id', '=', dispenseLineId).executeTakeFirstOrThrow();
  const remaining = Number(line.quantity) - Number(line.returned_qty);
  await tx.updateTable('billing.charge').set({ status: 'reversed', reversed_at: sql`now()`, reverse_reason: 'medicine returned' }).where('id', '=', charge.id).execute();
  let repost: { chargeId: string; netMinor: number } | null = null;
  if (remaining > 0) {
    repost = await postCharge(tx, tenantId, {
      facilityId: charge.facility_id, patientId: charge.patient_id, encounterId: charge.encounter_id, billingAccountId: charge.billing_account_id,
      sourceType: 'dispense_line', sourceId: dispenseLineId, dispenseLineId, serviceDate: String(charge.service_date), itemId: charge.item_id,
      priceListItemId: charge.price_list_item_id, description: charge.description, hsnSacCode: charge.hsn_sac_code, quantity: remaining,
      unitPriceMinor: charge.unit_price_minor, taxInclusive: charge.is_tax_inclusive, postedBy: null,
    });
  }
  await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [
    { action: 'status_change', subjectType: 'billing.charge', subjectId: charge.id, patientId: charge.patient_id, reason: 'medicine returned', diff: { status: ['posted', 'reversed'], repostedChargeId: repost?.chargeId ?? null, remaining } },
  ]);
}
