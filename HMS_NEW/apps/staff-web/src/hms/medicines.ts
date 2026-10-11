// Shared pieces of the pharmacy and prescription screens (ERD m09): refusal texts, formatting and the API shapes.
import { label } from "./model";

/** Anyone who verifies, dispenses or reads the registers sees the Pharmacy page. */
export const PHARMACY_PAGE_PERMISSIONS = ["pharmacy.verify", "pharmacy.dispense", "pharmacy.registers"];

export const PHARMACY_REASONS: Record<string, string> = {
  not_a_drug: "Only active drugs can be prescribed.",
  quantity_required: "Give the quantity to dispense for a take-home prescription.",
  route_required: "Give the route.",
  registration_required: "Signing needs a current council registration on your staff record.",
  not_prescriber: "Only the prescribing doctor can do this.",
  override_required: "Some lines have warnings — give a reason to override each.",
  not_for_teleconsult: "These drugs cannot be prescribed in a teleconsultation.",
  encounter_closed: "This visit is closed.",
  invalid_state: "Not possible in its current state.",
  reason_required: "Give a reason.",
  notes_required: "Say why in the notes.",
  own_prescription: "A prescriber cannot verify their own prescription.",
  not_verified: "A pharmacist must verify it first.",
  prescription_expired: "The prescription has expired.",
  line_not_active: "That line is stopped, held or finished.",
  over_dispense: "More than was prescribed (or requested).",
  over_return: "More than was dispensed on that line.",
  above_mrp: "The price can't be above the MRP.",
  price_required: "This batch has no MRP — give the unit price.",
  insufficient_stock: "Not enough usable stock in this store.",
  batch_unavailable: "That batch isn't usable stock here.",
  batch_expired: "That batch has expired.",
  substitution_not_allowed: "The prescriber did not allow substitution on this line.",
  not_equivalent: "A substitute must be the same generic, strength and form.",
  not_a_dispensing_store: "That store does not dispense to patients.",
  store_mismatch: "The indent was sent to another store.",
  prescription_required: "Drugs are indented against a prescription line.",
  witness_required: "This drug needs a witness.",
  witness_not_eligible: "The witness must be a nurse or doctor at this clinic.",
  self_witness: "The witness must be someone else.",
  already_given: "This dose is already charted as given.",
  too_soon: "Too soon after the last PRN dose.",
  prn_reason_required: "Give the indication for the PRN dose.",
  scheduled_at_required: "Give the scheduled time.",
  no_care_relationship: "You are not caring for this patient.",
  module_inactive: "Pharmacy is switched off for this hospital.",
};

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const qty = (v: string | number | null | undefined) => (v === null || v === undefined ? "—" : String(Number(v)));

export type RxLine = {
  prescriptionItemId: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  baseUom: string;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  dose: string;
  doseUnit: string;
  route: string;
  frequencyCode: string;
  frequencyText: string | null;
  durationValue: number | null;
  durationUnit: string | null;
  quantityPrescribed: string | null;
  quantityDispensed: string;
  isPrn: boolean;
  instructions: string | null;
  foodRelation: string;
  substitutionAllowed: boolean;
  status: string;
  stopReason: string | null;
  warnings: { kind: string; detail: string }[];
  overrideReason: string | null;
  schedule: string;
  isNdps: boolean;
  isHighAlert: boolean;
  requiresWitness: boolean;
};
export type Rx = {
  prescriptionId: string;
  setting: string;
  status: string;
  prescriberStaffId: string;
  prescriberName: string;
  signedAt: string | null;
  advice: string | null;
  cancelReason: string | null;
  items: RxLine[];
  verifications: { outcome: string; notes: string | null; verifiedAt: string; verifiedBy: string }[];
};
export function lineText(l: Pick<RxLine, "dose" | "doseUnit" | "route" | "frequencyCode" | "frequencyText" | "durationValue" | "durationUnit">) {
  return `${qty(l.dose)} ${l.doseUnit} ${label(l.route)} ${l.frequencyCode === "CUSTOM" ? l.frequencyText : l.frequencyCode}${l.durationValue ? ` × ${l.durationValue} ${l.durationUnit}` : ""}`;
}
