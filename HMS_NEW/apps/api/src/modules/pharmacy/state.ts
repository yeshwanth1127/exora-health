// Shared pieces of M09: the module switch, where a record lives (for authorization) and database error
// mapping. Stock rules come from inventory (stockError); pharmacy adds its own ceilings.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, DomainError, forbidden, pgCode, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { assertModuleActive } from '../access/admin.ts';
import { stockError } from '../inventory/state.ts';

export { nextNo, pad } from '../diagnostics/state.ts';

export const actor = (ctx: { actor: { staffId?: string | undefined } }): string => {
  if (!ctx.actor.staffId) throw forbidden('only staff can work with prescriptions and medicines');
  return ctx.actor.staffId;
};

export const assertPharmacyActive = (db: Kysely<DB>, caller: Caller) => assertModuleActive(db, caller, 'pharmacy');

/** Turns pharmacy's database refusals into API errors; stock refusals as inventory maps them. */
export function pharmacyError(err: unknown): never {
  if (err instanceof DomainError) throw err;
  const c = (err as { constraint?: string }).constraint;
  if (pgCode(err) === '23514') {
    if (c === 'prescription_item_dispensed_check' || c === 'patient_indent_line_dispensed_check') throw conflict('more than was prescribed or requested', { reason: 'over_dispense' });
    if (c === 'dispense_line_returned_check') throw conflict('more than was dispensed on that line', { reason: 'over_return' });
    if (c === 'dispense_line_mrp_check') throw new DomainError('validation', 'the price is above the MRP', { reason: 'above_mrp' });
    if (c === 'medication_administration_witness_check') throw new DomainError('precondition_failed', 'this drug needs a witness', { reason: 'witness_required' });
  }
  if (pgCode(err) === '23505' && c === 'medication_administration_once') throw conflict('this dose is already charted as given', { reason: 'already_given' });
  return stockError(err);
}

export type Kind = 'encounter' | 'prescription' | 'prescription_item' | 'patient_indent' | 'dispense' | 'dispense_line';
export type Located = { facilityId: string; patientId: string } | undefined;

/** Facility and patient of a pharmacy record, for the route's permission check. */
export async function locate(db: Kysely<DB>, caller: Caller, kind: Kind, id: string): Promise<Located> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const q = {
      encounter: sql`SELECT facility_id, patient_id FROM clinical.encounter WHERE id = ${id}`,
      prescription: sql`SELECT facility_id, patient_id FROM pharmacy.prescription WHERE id = ${id}`,
      prescription_item: sql`SELECT p.facility_id, p.patient_id FROM pharmacy.prescription_item i JOIN pharmacy.prescription p ON p.id = i.prescription_id WHERE i.id = ${id}`,
      patient_indent: sql`SELECT facility_id, patient_id FROM pharmacy.patient_indent WHERE id = ${id}`,
      dispense: sql`SELECT facility_id, patient_id FROM pharmacy.dispense WHERE id = ${id}`,
      dispense_line: sql`SELECT d.facility_id, d.patient_id FROM pharmacy.dispense_line l JOIN pharmacy.dispense d ON d.id = l.dispense_id WHERE l.id = ${id}`,
    }[kind];
    const { rows: [r] } = await sql<{ facility_id: string; patient_id: string }>`${q}`.execute(tx);
    return r ? { facilityId: r.facility_id, patientId: r.patient_id } : undefined;
  });
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Staff who may witness a dose at a clinic: active, with a current grant there that can chart or prescribe medicines. */
export async function witnessesAt(tx: Transaction<DB>, facilityId: string, at: Date) {
  const { rows } = await sql<{ staffId: string; name: string; staffType: string }>`
    SELECT DISTINCT s.id AS "staffId", s.display_name AS name, s.staff_type AS "staffType"
    FROM platform.staff s
    JOIN platform.role_grant g ON g.staff_id = s.id AND (g.facility_id IS NULL OR g.facility_id = ${facilityId})
                              AND g.revoked_at IS NULL AND g.valid_from <= ${at} AND (g.valid_to IS NULL OR g.valid_to > ${at})
    JOIN platform.role_permission rp ON rp.role_id = g.role_id
    JOIN platform.permission p ON p.id = rp.permission_id AND p.code IN ('medication.administer', 'prescriptions.write')
    WHERE s.status = 'active'
    ORDER BY 2`.execute(tx);
  return rows;
}
