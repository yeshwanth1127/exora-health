// Pharmacy reads: the dispensing queue (signed prescriptions not yet filled), a visit's prescriptions,
// one prescription with what is left to dispense, dispenses and counter sales, the ward indent queue and
// the controlled-drug register. Each by-id read tells the route which facility the record belongs to.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

type Scoped = 'pharmacy.prescription' | 'pharmacy.dispense' | 'pharmacy.patient_indent';

export async function pharmacyFacility(db: Kysely<DB>, caller: Caller, table: Scoped, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom(table).select('facility_id').where('id', '=', id).executeTakeFirst())?.facility_id);
}

export async function prescriptionItemFacility(db: Kysely<DB>, caller: Caller, prescriptionItemId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('pharmacy.prescription_item as l').innerJoin('pharmacy.prescription as p', 'p.id', 'l.prescription_id').select('p.facility_id').where('l.id', '=', prescriptionItemId).executeTakeFirst())?.facility_id);
}

export async function dispenseLineFacility(db: Kysely<DB>, caller: Caller, dispenseLineId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('pharmacy.dispense_line as l').innerJoin('pharmacy.dispense as d', 'd.id', 'l.dispense_id').select('d.facility_id').where('l.id', '=', dispenseLineId).executeTakeFirst())?.facility_id);
}

export async function encounterFacility(db: Kysely<DB>, caller: Caller, encounterId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('clinical.encounter').select('facility_id').where('id', '=', encounterId).executeTakeFirst())?.facility_id);
}

export async function dispensingQueue(db: Kysely<DB>, caller: Caller, q: { facilityId: string; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT p.id AS "prescriptionId", p.setting, p.status, p.signed_at AS "signedAt", p.valid_until::text AS "validUntil",
             p.patient_id AS "patientId", pt.mrn, concat_ws(' ', pt.given_name, pt.family_name) AS "patientName", s.display_name AS "prescriber",
             (SELECT count(*) FROM pharmacy.prescription_item l WHERE l.prescription_id = p.id AND l.status = 'active'
                AND (l.quantity_prescribed IS NULL OR l.quantity_dispensed < l.quantity_prescribed))::int AS "openLines"
      FROM pharmacy.prescription p JOIN patient.patient pt ON pt.id = p.patient_id JOIN platform.staff s ON s.id = p.prescriber_staff_id
      WHERE p.facility_id = ${q.facilityId} AND p.status IN ('signed', 'partially_dispensed') AND p.setting <> 'inpatient'
        AND (p.valid_until IS NULL OR p.valid_until >= current_date)
      ORDER BY p.signed_at LIMIT ${q.limit}`.execute(tx);
    return rows;
  });
}

export async function encounterPrescriptions(db: Kysely<DB>, caller: Caller, encounterId: string) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('pharmacy.prescription').select(['id as prescriptionId', 'setting', 'status', 'signed_at as signedAt', 'valid_until as validUntil', 'prescriber_staff_id as prescriberStaffId', 'version'])
    .where('encounter_id', '=', encounterId).orderBy('created_at').execute());
}

export async function getPrescription(db: Kysely<DB>, caller: Caller, prescriptionId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const p = await tx.selectFrom('pharmacy.prescription as p').innerJoin('patient.patient as pt', 'pt.id', 'p.patient_id').innerJoin('platform.staff as s', 's.id', 'p.prescriber_staff_id')
      .select(['p.id', 'p.encounter_id', 'p.patient_id', 'p.facility_id', 'p.setting', 'p.status', 'p.signed_at', 'p.valid_until', 'p.advice', 'p.cancel_reason', 'p.version',
        'pt.mrn', 'pt.given_name', 'pt.family_name', 'p.prescriber_staff_id', 's.display_name as prescriber'])
      .where('p.id', '=', prescriptionId).executeTakeFirst();
    if (!p) throw notFound('prescription', { prescriptionId });
    const lines = await tx.selectFrom('pharmacy.prescription_item').selectAll().where('prescription_id', '=', p.id).orderBy('line_no').execute();
    return {
      prescriptionId: p.id, encounterId: p.encounter_id, facilityId: p.facility_id, setting: p.setting, status: p.status, signedAt: p.signed_at, validUntil: p.valid_until,
      advice: p.advice, cancelReason: p.cancel_reason, version: p.version,
      patient: { patientId: p.patient_id, mrn: p.mrn, name: [p.given_name, p.family_name].filter(Boolean).join(' ') },
      prescriber: { staffId: p.prescriber_staff_id, name: p.prescriber },
      lines: lines.map((l) => ({
        prescriptionItemId: l.id, lineNo: l.line_no, itemId: l.item_id, genericName: l.generic_name, brandName: l.brand_name, strength: l.strength, dose: Number(l.dose),
        doseUnit: l.dose_unit, route: l.route, frequency: l.frequency_code, frequencyText: l.frequency_text, duration: l.duration_value ? `${l.duration_value} ${l.duration_unit}` : null,
        quantityPrescribed: l.quantity_prescribed === null ? null : Number(l.quantity_prescribed), quantityDispensed: Number(l.quantity_dispensed),
        remaining: l.quantity_prescribed === null ? null : Number(l.quantity_prescribed) - Number(l.quantity_dispensed),
        isPrn: l.is_prn, foodRelation: l.food_relation, instructions: l.instructions, substitutionAllowed: l.substitution_allowed, status: l.status,
        warnings: l.warnings, overrideReason: l.override_reason, version: l.version,
      })),
    };
  });
}

export async function listDispenses(db: Kysely<DB>, caller: Caller, q: { facilityId: string; type?: string | undefined; patientId?: string | undefined; date?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT d.id AS "dispenseId", d.dispense_no AS "dispenseNo", d.dispense_type AS type, d.status, d.dispensed_at AS "dispensedAt", d.patient_id AS "patientId",
             coalesce(concat_ws(' ', p.given_name, p.family_name), d.buyer_name) AS "buyer", d.prescription_id AS "prescriptionId", d.patient_indent_id AS "indentId",
             (SELECT coalesce(sum(round(l.quantity * l.unit_price_minor)), 0) FROM pharmacy.dispense_line l WHERE l.dispense_id = d.id)::bigint AS "totalMinor"
      FROM pharmacy.dispense d LEFT JOIN patient.patient p ON p.id = d.patient_id JOIN platform.facility f ON f.id = d.facility_id
      WHERE d.facility_id = ${q.facilityId} AND (${q.type ?? null}::text IS NULL OR d.dispense_type = ${q.type ?? null})
        AND (${q.patientId ?? null}::uuid IS NULL OR d.patient_id = ${q.patientId ?? null}::uuid)
        AND (${q.date ?? null}::date IS NULL OR (d.dispensed_at AT TIME ZONE f.timezone)::date = ${q.date ?? null}::date)
      ORDER BY d.dispensed_at DESC LIMIT ${q.limit}`.execute(tx);
    return rows.map((r) => ({ ...r, totalMinor: Number(r['totalMinor']) }));
  });
}

export async function getDispense(db: Kysely<DB>, caller: Caller, dispenseId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const d = await tx.selectFrom('pharmacy.dispense').selectAll().where('id', '=', dispenseId).executeTakeFirst();
    if (!d) throw notFound('dispense', { dispenseId });
    const { rows: lines } = await sql<Record<string, unknown>>`
      SELECT l.id AS "dispenseLineId", l.item_id AS "itemId", i.name AS "itemName", ib.batch_no AS "batchNo", ib.expiry_date::text AS "expiryDate",
             l.quantity::float AS quantity, l.returned_qty::float AS "returnedQty", l.mrp_snapshot_minor AS "mrpMinor", l.unit_price_minor AS "unitPriceMinor",
             l.prescription_item_id AS "prescriptionItemId", l.patient_indent_line_id AS "indentLineId",
             (SELECT c.id FROM billing.charge c WHERE c.dispense_line_id = l.id AND c.status <> 'reversed' LIMIT 1) AS "chargeId"
      FROM pharmacy.dispense_line l JOIN inventory.item i ON i.id = l.item_id JOIN inventory.item_batch ib ON ib.id = l.item_batch_id
      WHERE l.dispense_id = ${d.id} ORDER BY l.created_at`.execute(tx);
    return {
      dispenseId: d.id, dispenseNo: d.dispense_no, type: d.dispense_type, status: d.status, dispensedAt: d.dispensed_at, facilityId: d.facility_id, storeId: d.store_id,
      patientId: d.patient_id, buyerName: d.buyer_name, buyerPhone: d.buyer_phone, prescriptionId: d.prescription_id, indentId: d.patient_indent_id, lines,
    };
  });
}

export async function indentQueue(db: Kysely<DB>, caller: Caller, q: { facilityId: string; admissionId?: string | undefined; open: boolean; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT n.id AS "indentId", n.indent_no AS "indentNo", n.status, n.requested_at AS "requestedAt", n.admission_id AS "admissionId", a.ip_no AS "ipNo",
             n.patient_id AS "patientId", concat_ws(' ', p.given_name, p.family_name) AS "patientName", n.version,
             (SELECT l.name FROM inpatient.bed_occupancy o JOIN platform.location l ON l.id = o.bed_location_id
               WHERE o.admission_id = n.admission_id AND o.kind = 'primary' AND upper_inf(o.period) LIMIT 1) AS bed,
             (SELECT json_agg(json_build_object('indentLineId', il.id, 'itemId', il.item_id, 'itemName', i.name, 'requested', il.qty_requested::float,
                                                'dispensed', il.qty_dispensed::float, 'prescriptionItemId', il.prescription_item_id) ORDER BY il.created_at)
              FROM pharmacy.patient_indent_line il JOIN inventory.item i ON i.id = il.item_id WHERE il.patient_indent_id = n.id) AS lines
      FROM pharmacy.patient_indent n JOIN inpatient.admission a ON a.id = n.admission_id JOIN patient.patient p ON p.id = n.patient_id
      WHERE n.facility_id = ${q.facilityId} AND (${q.admissionId ?? null}::uuid IS NULL OR n.admission_id = ${q.admissionId ?? null}::uuid)
        AND (NOT ${q.open} OR n.status IN ('submitted', 'partially_dispensed'))
      ORDER BY n.requested_at LIMIT ${q.limit}`.execute(tx);
    return rows;
  });
}

export async function controlledRegister(db: Kysely<DB>, caller: Caller, q: { facilityId: string; from: string; to: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT r.dispense_no AS "dispenseNo", r.dispensed_at AS "dispensedAt", r.patient_id AS "patientId", r.mrn, r.patient_name AS "patientName",
             r.prescriber_name AS "prescriber", r.generic_name AS "genericName", r.item_name AS "itemName", r.regulatory_schedule AS schedule, r.is_ndps AS "isNdps",
             r.batch_no AS "batchNo", r.quantity::float AS quantity, r.returned_qty::float AS "returnedQty"
      FROM pharmacy.controlled_drug_register r JOIN platform.facility f ON f.id = r.facility_id
      WHERE r.facility_id = ${q.facilityId} AND (r.dispensed_at AT TIME ZONE f.timezone)::date BETWEEN ${q.from}::date AND ${q.to}::date
      ORDER BY r.dispensed_at`.execute(tx);
    return rows;
  });
}
