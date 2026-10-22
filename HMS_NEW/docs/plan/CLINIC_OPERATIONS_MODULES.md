<!-- Copied from the approved plan (2026-10-21). Keep in sync with what is built: mark phases done here. -->
# Billing, Pharmacy, Inpatient (IPD) and HR/Staff — backend architecture (exora-health / HMS_NEW)

## Context

After a clinic is provisioned, its admin dashboard (`apps/staff-web`) shows Clinic / Care / Messages / Growth / Workspace menus. There is no way to admit patients, bill them, run a pharmacy or manage staff as employees. This plan adds these backend modules, with **no frontend work yet**. They must slot into the existing menu model so the screens can be built later.

**Scope the user chose:**
- **Inpatient (new module):** admission with an IP number, bed status and occupancy, transfers, discharge with clearances, and a bed board.
- **Billing:** outpatient and inpatient billing.
  - Outpatient: consultation and pharmacy charges, GST invoices, payments, receipts, refunds, credit notes, cashier day close.
  - Inpatient: **deposits and advances**, **daily bed-day charges**, an **interim statement** and a **final bill** that gates discharge.
  - Out: insurance/TPA, packages and estimates. Invoice lines leave room for a later payer split.
- **Pharmacy:** prescriptions, batch/expiry stock, supplier receipts, dispensing against a prescription, **walk-in OTC counter sales**, and for inpatients **ward indents**, **ongoing inpatient medication orders and a discharge prescription**, and **MAR (dose charting)**.
  - Out: ward sub-stores, requisitions and transfers. The pharmacy dispenses straight to the patient's ward.
- **HR:** employee profiles, shifts and attendance, leave, and payroll.
- **Switching:** each module can be turned on or off per clinic through `platform.module_state`.

**Scope reversal.** The repo currently declares these modules out of scope:
- `docs/plan/BACKEND_COMPLETION_GUIDE.md:20-22`
- `STAFF_MODULE_DEVELOPMENT_DECISIONS.md:24`
- `BACKEND_WORK_LEDGER.md:55,76`

Commit `0aaff77` removed an earlier hospital-scale M09/M10, with a note not to restore it. This plan is the product owner's explicit reversal of that decision. The first step updates those docs so the guardrails agree with the new decision. The removed code (`git show 1a3137a`, `4c8ad57`) is used only as **reference material** and is trimmed to clinic scope. It is not restored as-is.

## How things work today (what we build on)

**Menu.**
- Static array in `apps/staff-web/src/App.tsx:83-176`: `{group, key, name, icon, permission}`, gated only by `can(me, permission, facilityId)` from `GET /v1/me`.
- Sub-tabs are in `apps/staff-web/src/hms/workspace-navigation.ts` (`workspaceTabs`).
- `GET /v1/session-context` already returns `modules`, but the UI ignores it.

**Writes.**
- Routes: zod `parse` → `authorize(principal, perm, facilityId)` → module command.
- `runCommand` (`packages/platform/src/command.ts:78`) handles tenant RLS, `SET LOCAL ROLE mod_<module>`, idempotency, `audit_event` and `outbox_event` in one transaction.
- Optimistic `version` on updates.
- Helpers live in `apps/api/src/http/support.ts`.

**Events.** `EventHandler`s in `apps/api/src/consumers.ts` are run by the worker, de-duplicated through the inbox. Example: `appointment.checked_in` → open encounter.

**Database.**
- One schema and one `mod_<x>` write role per module, with composite `(tenant_id, id)` FKs.
- `platform.setup_tenant_table()` and `platform.forbid_change()` handle RLS, versioning and append-only tables. The boilerplate to copy is in `db/migrations/20261010101100_m05_clinical.sql:1-20`.
- `db/tests/conventions.test.ts` enforces these rules.

**Module switches.**
- `platform.module_state` already allows `billing`, `pharmacy`, `inventory` and `operations`.
- API: `modules/access/admin.ts` — `MODULES`:206, `CORE`:212, `moduleStates`:227 (**treats a missing row as active**), `setModuleState`:238, and `assertModuleActive`:256, which nothing calls yet. Routes are `GET/PUT /v1/modules`.

**Provisioning.**
- `db/scripts/bootstrap-runtime.mjs:97-103` writes `module_state` rows (core, plus comms unless the plan is Launch).
- Control plane: `apps/control-api/src/main.ts` `markReady` / `modulesFor(plan)`.

**Pricing.**
- `catalog.price_list_item` already has `item_id`, `item_pricing_method` (`mrp_less_discount`, `cost_plus_markup`) and `charge_trigger` (`on_dispense`), plus `catalog.tax_rule`.
- `booking.appointment.fee_snapshot_minor` and `price_list_item_id` record the booked fee.

**Shared tables.**
- `platform.facility.gstin` / `state_code`.
- `platform.number_series` kinds already include `invoice`, `bill_of_supply`, `credit_note`, `receipt`, `dispense` and `grn`.
- `booking.schedule_exception` (kind `closed`/`block`) is used for doctor leave.

## Architecture overview

| Menu (future) | Module code(s) | Schema / role | ERD basis |
|---|---|---|---|
| **Inpatients** | `inpatient` | `inpatient` / `mod_inpatient` | m07, trimmed (simple housekeeping, no bed reservations) |
| **Billing** | `billing` | `billing` / `mod_billing` | m11: OPD + IPD deposits, bed-day charges and final bill; no packages, estimates or ledger |
| **Pharmacy** | `inventory` + `pharmacy` (switched together) | `inventory` / `mod_inventory`, `pharmacy` / `mod_pharmacy` | m10 + m09, trimmed, plus OTC |
| **Staff / HR** | `hr` (new code) | `hr` / `mod_hr` | m15 workforce subset, plus payroll (new) |

**Why `hr` instead of the ERD's `operations`.** The ERD's `operations` schema holds work queues and facility services. Payroll and bank data are sensitive HR data with a different access group, so they get their own schema and their own `payroll.*` permissions. `operations` stays free for M15 work queues later.

**Cross-module rules.**
- **Synchronous** cross-schema writes go only through `SECURITY DEFINER` functions owned by the target module that validate their caller's claim. Stock movements need this: a dispense must never commit without its stock issue. The removed M09 used the same pattern (`inventory.post_patient_movement`).
- **Money** flows through **outbox events → billing consumers** (`dispense.completed` → charge lines), and is idempotent through the partial unique index on `(source_type, source_id)`.

```
appointment.checked_in ──► billing: consultation charge (from appointment.fee_snapshot_minor)
appointment.cancelled  ──► billing: reverse un-invoiced consultation charge
dispense.completed     ──► billing: one charge per dispense line (GST from tax_rule)
dispense.returned      ──► billing: reversal / credit note candidate
goods.received         ──► (none yet; later the ledger)
admission.admitted     ──► billing: open the IPD billing_account (episode), check deposit_rule
bed.occupied/.vacated  ──► billing: bed-day job reads inpatient.bed_occupancy (charge key = occupancy + service_date)
discharge.planned      ──► pharmacy/billing: create pending pharmacy + finance clearances
invoice.issued / payment.captured (final bill fully settled or waived) ──► inpatient: finance clearance cleared
prescription.signed (inpatient) ──► (read model) MAR schedule shown to nurses
leave.approved         ──► booking: schedule_exception 'closed' for doctor resources + staff alert on affected appointments
leave.cancelled        ──► booking: remove the exceptions it created
```

## Phase 0 — Platform plumbing (do first)

1. **Docs.**
   - Record the scope decision in `docs/plan/BACKEND_COMPLETION_GUIDE.md`, `STAFF_MODULE_DEVELOPMENT_DECISIONS.md`, `BACKEND_WORK_LEDGER.md` and `SCHEMA_PLAN.md` §6.
   - Add a "clinic-scope" note to `docs/design/erd-v2/m09`, `m10` and `m11`.
   - Add a new `docs/design/erd-v2/m18-hr.md`.
   - Add a section in `HMS_NEW/AGENTS.md` pointing to this plan.
2. **Module gating** (one place, not per route):
   - Add `inpatient`, `billing`, `inventory`, `pharmacy` and `hr` to `MODULES` in `packages/platform/src/command.ts:11`.
   - In `runCommand`, for non-core modules, lock the module's `module_state` row `FOR SHARE` and throw `precondition_failed` with reason `module_inactive` unless the state is `active`. This reuses the logic of `assertModuleActive`.
   - Event consumers for an inactive module skip their work and complete normally, so they don't retry forever.
   - Reads use a small `moduleRoutes(app, module, register)` wrapper in `http/support.ts`. It adds an `onRequest` hook calling `assertModuleActive`, so all of a module's routes are gated together.
   - `moduleStates()`: a missing row means `active` only for the existing modules. For the new codes, a missing row means `not_provisioned`. Existing tenants therefore don't suddenly get the new modules.
   - `setModuleState`: switching `pharmacy` also switches `inventory`, in one command. **`inpatient` requires `billing` to be active**, because discharge needs finance clearance; enabling it is refused otherwise. Without pharmacy active, the pharmacy discharge clearance is created as `waived`.
   - Migration: add `'hr'` to the `module_state.module_code` CHECK, and `'payslip'` to the `number_series` kinds if needed.
3. **Provisioning.**
   - `bootstrap-runtime.mjs` writes rows for `inpatient`, `billing`, `inventory`, `pharmacy` and `hr` as `configured` (entitled but off). An optional `TENANT_CLINIC_MODULES` env (comma list) narrows the entitlement; nothing sets it yet.
   - The clinic admin turns modules on through the existing `PUT /v1/modules/:module`.
   - Not done: the control plane's `modulesFor(plan)` (`apps/control-api/src/main.ts`) is unchanged. A per-plan entitlement map would go there and be passed as `TENANT_CLINIC_MODULES`.
4. **Menu contract for the future frontend.**
   - The frontend reads module states from `GET /v1/session-context` (`modules`), which already returns them. `/v1/me` is unchanged.
   - Each future menu item is gated by **permission AND module active**.
   - Proposed menu entries go into a doc only, not into staff-web code:
     - **Inpatients** (`inpatient.read`), in the Care group: tabs Bed board · Admissions · Discharges · Wards & beds setup
     - **Billing** (`billing.read`): tabs Overview · Pending charges · Invoices · Payments · Refunds & credit notes · Day close · Settings
     - **Pharmacy** (`pharmacy.read`): Prescriptions · Dispense & counter sale · Stock · Purchases · Items & suppliers · Registers · Settings
     - **Staff** (`hr.read`): Directory · Attendance · Shifts & roster · Leave · Payroll · Settings
5. **Shared lists to extend** for every new schema:
   - `schemas` in `db/scripts/codegen.mjs:8`
   - `ModuleRole` in `db/tests/db.ts:16`
   - `MODULE_ROLE` in `db/tests/conventions.test.ts:10`
   - `MODULES` in `modules/access/admin.ts:206` (add `hr`)
   - route registration in `apps/api/src/server.ts`
   - consumers in `apps/api/src/consumers.ts`

## Phase 1 — Billing (`billing` schema)

**Migration** `db/migrations/2026102210xxxx_m11_billing.sql`. Every table carries the standard columns; money is bigint paise.

| Table | Purpose and key rules |
|---|---|
| `charge` | Columns: `source_type` (`consultation`, `dispense_line`, `manual`), `source_id` plus typed nullable FKs (`appointment_id`, `dispense_line_id`); `patient_id` (nullable only for OTC); `encounter_id`; `facility_id`; `service_item_id` or `item_id`; a description snapshot; qty, unit price and `price_list_item_id` snapshot; gross, discount, taxable, cgst, sgst, igst, net; `gst_rate_bp`; `tax_rule_id`; status (`posted`, `invoiced`, `reversed`); `reversal_of_id`. **Partial unique index on `(tenant, source_type, source_id)` where status ≠ reversed.** Corrections are reversal rows, never UPDATEs of amounts. |
| `charge_adjustment` | Discount or write-off with a reason. Requires `billing.approve` above the role's `settings.max_discount_percent`. |
| `invoice`, `invoice_line` | `document_type` (`tax_invoice`, `bill_of_supply`, `invoice_cum_bill_of_supply`), derived from the lines: consultations are GST-exempt, medicines are taxable. `bill_kind` (`opd`, `pharmacy`). Bill-to snapshot: patient, or OTC name/phone. Totals plus `round_off_minor`; `paid_minor`. Status: `draft` → `issued` → `partially_paid` / `paid`; `void`; `credited`. **The number is assigned at issue** from `number_series` per facility per financial year. Issued invoices are immutable (trigger). |
| `credit_note`, `credit_note_line` | Against an issued invoice, with a tax reversal. Requires `billing.approve`. |
| `cashier_shift` | Opening float; expected, counted and variance; `open` → `closed` → `verified`. Required for cash payments. |
| `payment` | `method` (`cash`, `upi`, `card`, `net_banking`, `cheque`, `wallet`); reference number; status (`captured`, `refunded`, `partially_refunded`, `bounced`). Recording only, with no gateway. The **s.269ST cash check** applies: cash of ₹2 lakh or more per person per day is refused. |
| `payment_allocation` | Payment ↔ invoice. Both are locked; Σ ≤ the payment and ≤ the invoice balance. |
| `receipt` | 1:1 with payment, numbered from the `receipt` series. |
| `refund` | `requested` → `approved` → `paid`. Optionally linked to a credit note. |

**Inpatient additions** (the same migration, or `m11_billing_ipd` once Phase 2 exists):

| Table / job | Purpose and key rules |
|---|---|
| `billing_account` | One per IPD episode (admission). It is opened by an `admission.admitted` consumer, or lazily by the admission command's event. OPD charges keep `billing_account_id` NULL; IPD charges require it. Status: `open` → `final_billed` → `closed`. |
| `deposit_rule` | Per facility and bed category: `min_deposit_minor`, `alert_below_minor`. |
| `deposit` | Funded by a `payment` (`payer_type = patient`, with an `is_advance` flag). Status: `held` → `applied` / `refunded`. Applying it to the final invoice creates a `payment_allocation`, not a second payment. |
| Bed-day job | Run daily by the worker and on discharge. It walks `inpatient.bed_occupancy` with `catalog.bed_charge_rule` (midnight census, 24h-from-admit or any-part-of-day; grace and half-day) and posts `source_type = 'bed_day'` charges, keyed by **(occupancy_id, service_date)**, so reruns are safe. The price is the bed category's `price_list_item` (`bed_category_id`). It also posts charges for retained beds. |
| Interim statement | `GET /v1/billing/accounts/:id/statement`. A read model, not an invoice and with no number: charges to date, deposits, running balance, and the deposit-low flag. |
| Final bill | `POST /v1/billing/accounts/:id/final-invoice` runs the bed-day job up to the departure time, invoices every un-invoiced charge (`bill_kind = 'ipd_final'`) and auto-applies held deposits. When the balance reaches 0, or an approved write-off covers it, it emits `billing.account_settled`. The inpatient consumer then clears the **finance** clearance. Any excess deposit becomes a refund request. |

The **s.269ST** cash check applies per episode as well as per person per day.

`charge.source_type` gains `bed_day`, `indent_dispense_line` (pharmacy dispenses to the ward) and `procedure` (manual, for the doctor's daily visit or nursing). Typed FKs are `bed_occupancy_id` and `admission_id`.

**Code.**
- `apps/api/src/modules/billing/{charges,invoices,payments,cashier,deposits,bed-days,read,tax}.ts`.
- `tax.ts` resolves the `catalog.tax_rule` for a line and computes CGST+SGST or IGST from `facility.state_code`, rounding half-up per line.
- Consumers live in `consumers.ts`: `billing.charge_consultation_on_check_in`, `billing.reverse_consultation_on_cancel` and `billing.charge_dispense_lines`.

**Routes** `http/routes/billing.ts`, all with `facilityId` scope:

| Endpoint | Purpose |
|---|---|
| `GET /v1/billing/summary?facilityId&date` | Day overview |
| `GET /v1/billing/charges?patientId\|status` | Pending charges |
| `POST /v1/billing/charges` | Manual charge |
| `POST /v1/billing/charges/:id/reverse` | Reverse a charge |
| `POST /v1/billing/charges/:id/adjustments` | Discount or write-off; `POST /v1/billing/adjustments/:id/approve` |
| `POST /v1/billing/invoices` | Draft from charge ids, or all of a patient's pending charges |
| `POST /v1/billing/invoices/:id/issue` | Issue the invoice |
| `POST /v1/billing/invoices/:id/void` | Void an invoice that has no payments |
| `GET /v1/billing/invoices[/:id]` | List and detail; a printable JSON payload, with no PDF yet |
| `POST /v1/billing/payments` | Payment plus allocations plus receipt, in one command |
| `POST /v1/billing/refunds` | Request a refund; `/approve` and `/paid` to settle |
| `POST /v1/billing/credit-notes` | Credit note |
| `POST /v1/billing/cashier-shifts` | Open a shift; `/:id/close` and `/:id/verify` |
| `GET /v1/billing/accounts?admissionId\|status` | IPD accounts; `/:id/statement` gives the interim statement |
| `POST /v1/billing/accounts/:id/deposits` | Take a deposit; `GET /v1/billing/deposit-alerts?facilityId` lists accounts below the alert threshold |
| `POST /v1/billing/accounts/:id/final-invoice` | Final bill |
| `PUT /v1/billing/deposit-rules` | Configure deposit rules (`billing.settings`) |

**Permissions** (`db/seeds/reference/090_permissions_billing.sql`): `billing.read`, `billing.charge`, `billing.invoice`, `billing.collect`, `billing.refund`, `billing.approve` and `billing.settings`. They go in a new system role **`cashier`**; `tenant_admin` gets all of them, and `front_desk` gets read, charge, invoice and collect.

## Phase 2 — Pharmacy (`inventory` + `pharmacy` schemas)

Start from the removed migrations `20261014100000_m10_inventory.sql` and `20261014101000_m09_pharmacy.sql`, read with `git show 4c8ad57:` / `1a3137a:`.
- **Keep:** items and drug profiles, batches, the movement ledger, prescriptions (`setting`: outpatient, inpatient, discharge), dispensing, returns, the H1 view, **patient indents** and **MAR**.
- **Drop:** requisitions, ward sub-stores and transfers, POs and three-way match, and stock counts.
- **New timestamps:** use dates after the latest migration (`20261018100000`), and first check that no tenant DB's `schema_migrations` still lists the old versions.

**`inventory`:**

| Table | Purpose and key rules |
|---|---|
| `item`, `drug_product`, `item_uom` | Shared drug and consumable master. HSN code, schedule (`H`, `H1`, `X`), NDPS, high-alert, strip-to-tablet pack factors |
| `store` | One pharmacy store per facility to start; `drug_licence_no` |
| `supplier` | GSTIN and drug licence number |
| `item_batch` | Batch number, expiry, `mrp_minor`, `unit_cost_minor`, status |
| `stock_movement` | Append-only, monthly partitions. Types: opening, receipt, sale/issue, patient return, adjustment, expiry disposal, damage, vendor return |
| `stock_balance` | `on_hand ≥ 0` CHECK, updated under row lock in the movement's transaction; nightly reconcile job |
| `goods_receipt`, `goods_receipt_line` | Direct receipts against the supplier's invoice reference; each line creates or tops up a batch |
| `stock_adjustment` | Reason, plus approval for write-offs |

The `SECURITY DEFINER` function `inventory.post_issue(...)` is the **FEFO** picker. It refuses expired, quarantined or recalled batches and insufficient stock.

**`pharmacy`:**

| Table | Purpose and key rules |
|---|---|
| `prescription`, `prescription_item` | Written by the doctor on an encounter. Sign requires a valid `staff_registration`. Allergy check against `clinical.allergy_intolerance`, with the override reason kept. Generic and brand snapshot; frequency, duration and quantity. |
| `dispense`, `dispense_line` | `dispense_type` (`prescription`, `otc`). **OTC: no prescription; `patient_id` optional, with buyer name and phone; Schedule H/H1/X/NDPS items refused for OTC.** Each line has a batch, `mrp_snapshot_minor`, and `unit_price_minor ≤ MRP` (CHECK). Σ dispensed ≤ prescribed under a lock. The `dispense` series supplies the number. Emits `dispense.completed`. |
| `medication_return` | Restockable flag. Creates a return movement and emits `dispense.returned`. Inpatient returns from the ward at discharge use the same table. |
| Inpatient orders | `prescription.setting = 'inpatient'`, linked to the admission's encounter. `quantity_prescribed` may be NULL (ongoing); hold and stop with a reason. Discharge prescriptions use `setting = 'discharge'` and are linked from `inpatient.discharge`. |
| `patient_indent`, `patient_indent_line` | A nurse requests from the ward, for an admitted patient (encounter must be inpatient and the admission `admitted`). A line carries `prescription_item_id`, or NULL for consumables. Status: `submitted` → `partially_dispensed` → `dispensed` / `cancelled`. It is filled by `dispense_type = 'ipd_indent'`, whose charges go to the patient's IPD billing account. |
| `medication_administration` (MAR) | Append-only: given, not given, held, refused, self-administered. One `given` per (item, scheduled_at) for non-PRN doses; PRN doses checked against a minimum interval under a lock. A **witness** is required for H1/X/NDPS and high-alert drugs. Optionally links the `dispense_line` that supplied the dose. |
| Pharmacy clearance | A `discharge.planned` consumer checks for open indents or unreturned ward stock. `POST /v1/pharmacy/discharge-clearances/:admissionId/clear` lets the pharmacist clear it. |
| View `h1_register` | Schedule H1 entries, read over dispense lines |
| Read models (no tables) | Low-stock and near-expiry lists |

**Pricing.** The sell price comes from `catalog.price_list_item` (`item_id`, `mrp_less_discount`), falling back to MRP. GST comes from `tax_rule` by HSN code.

**Routes** `http/routes/inventory.ts`, `http/routes/pharmacy.ts`:

| Area | Endpoints |
|---|---|
| Items and suppliers | `/v1/inventory/items`, `/v1/inventory/suppliers` |
| Stock | `/v1/inventory/stock?storeId`, `/v1/inventory/batches/:id/status` |
| Receipts and adjustments | `/v1/inventory/receipts`, `/v1/inventory/adjustments` |
| Alerts | `/v1/inventory/alerts` (low or expiring) |
| Prescriptions | `/v1/encounters/:id/prescriptions`; `/v1/prescriptions/:id/{sign,cancel}`; `GET /v1/pharmacy/queue` (signed and not fully dispensed) |
| Dispensing and sales | `POST /v1/pharmacy/dispenses` (Rx or OTC); `/v1/pharmacy/returns` |
| Registers | `GET /v1/pharmacy/registers/h1` |
| Indents | `/v1/admissions/:id/indents` (nurse); `GET /v1/pharmacy/indent-queue`; dispense through `POST /v1/pharmacy/dispenses` with `indentId` |
| MAR | `GET /v1/admissions/:id/mar?date` (schedule × recorded doses); `POST /v1/admissions/:id/mar` |
| Order changes | `POST /v1/prescription-items/:id/{hold,resume,stop}` |

**Permissions.** Reuse the removed seed names: `prescriptions.read`, `prescriptions.write`, `pharmacy.dispense`, `pharmacy.registers`, `inventory.read`, `inventory.manage` and `inventory.receive`. Add `pharmacy.sell` (OTC), `pharmacy.read`, `inventory.adjust`, `pharmacy.indent` and `medication.administer` (the last two from the removed seed). Roles: `pharmacist`; `doctor` gets the prescriptions permissions; `nurse` gets `prescriptions.read`, `pharmacy.indent` and `medication.administer`.

## Phase 2b — Inpatient (`inpatient` schema, ERD m07 trimmed)

Build this **after Billing and before Pharmacy's inpatient parts**. Order: Billing (OPD) → Inpatient core → Billing IPD → Pharmacy (OPD + indents/MAR).

**Bed setup.** Wards, rooms and beds are `platform.location` rows, written by `mod_platform`. Add commands next to the existing consult-room commands in `apps/api/src/modules/directory/admin.ts:249-298`:
- create and update ward, room and bed;
- CRUD for `catalog.bed_category` (exists);
- bed price per category, by extending `publishPrice` in `modules/directory/pricing.ts` with `bedCategoryId`, since `price_list_item.bed_category_id` already exists.

Bed rows must have a ward ancestor and a `bed_category`; the location CHECK already exists.

| Table | Purpose and key rules |
|---|---|
| `admission` | `ip_no` from `number_series` kind `ip_no` (exists). Types: elective, emergency, day_care, maternity. Status: `admitted` → `discharge_planned` → `discharged` / `cancelled`. Requested-to-admitted steps are collapsed for a clinic; `bed_pending` is kept. 1:1 with an encounter of class `inpatient` or `day_care`, opened by the same command through a clinical `SECURITY DEFINER` function, or through `admission.admitted` → clinical consumer. Also: patient, admitting doctor, department, and source OPD encounter. |
| `admission_status_history` | Every transition |
| `bed_status`, `bed_status_history` | 1:1 bed location: `ready`, `occupied`, `dirty`, `blocked`, `maintenance`. Housekeeping is simplified to dirty → `POST /v1/beds/:id/ready`. |
| `bed_occupancy` | `period tstzrange`, `kind` (primary or retained), `billed_bed_category_id`. **EXCLUDE: one occupant per bed; one primary bed per admission.** Admit and transfer lock `bed_status` and allow only `ready` beds. |
| `transfer` | Bed-to-bed in one step: close the old occupancy, open the new one, old bed → dirty. Optionally retain the old bed while in ICU. |
| `discharge` | `discharge_type` (routine, lama, dama, absconded, transfer_out, referred, death); `summary_note_id` (clinical note); `discharge_prescription_id`. Status: `planned` → `cleared` → `departed`. |
| `discharge_clearance` | Kinds: clinical, pharmacy, nursing, finance. Status: `pending`, `cleared` or `waived` (reason and `inpatient.discharge.override` required). **Departure requires all clearances cleared or waived.** |

Departure closes the occupancy, sets the bed to dirty and finishes the encounter (`encounter.finished` → existing consumers).

**Routes** `http/routes/inpatient.ts`:

| Endpoint | Purpose |
|---|---|
| `GET /v1/inpatient/bed-board?facilityId` | Wards → beds with status, occupant summary (no clinical detail) and expected discharge |
| `GET /v1/admissions[/:id]` | List and detail |
| `POST /v1/admissions` | Admit; patient, doctor, bed or pending, and type |
| `POST /v1/admissions/:id/assign-bed` | Assign a bed to a `bed_pending` admission |
| `POST /v1/admissions/:id/transfer` | Transfer |
| `POST /v1/admissions/:id/cancel` | Cancel |
| `POST /v1/admissions/:id/discharge` | Plan the discharge |
| `POST /v1/discharges/:id/clearances/:kind/{clear,waive}` | Clear or waive a clearance |
| `POST /v1/discharges/:id/depart` | Departure |
| `POST /v1/beds/:id/{ready,block,unblock}` | Bed status |
| `/v1/facilities/:id/wards`, `/v1/wards/:id/beds`, `/v1/bed-categories` | Setup, through directory routes with `facility.manage` and `pricing.manage` |

**Access.** Admitting, transferring or discharging requires `inpatient.manage`. Clinical access for the admitted patient's encounter follows the existing `care_assignment` rule: admission creates an `attending` care_assignment for the admitting doctor.

**Permissions:** `inpatient.read`, `inpatient.manage`, `inpatient.discharge` (plan and clear clinical) and `inpatient.discharge.override` (waive). System roles: `doctor` gets read and discharge; `nurse` gets read and clears the nursing clearance; `front_desk` gets read and manage.

## Phase 3 — HR / Staff (`hr` schema, new `m18-hr.md`)

`platform.staff` stays the identity record, written by `mod_platform`. HR adds 1:1 and child tables keyed by `staff_id`.

| Area | Tables | Key rules |
|---|---|---|
| Profiles | `employee_profile` (designation, department_id, date of joining or exit, reporting_to, emergency contact, address); `employee_statutory` (PAN, UAN, ESIC no., bank account and IFSC; **sensitive**, `payroll.read` only; Aadhaar never stored) | Exit sets `platform.staff.active_to` through an event or platform command, not a direct write |
| Shifts and attendance | `shift_definition` (start and end local, break, grace); `roster_assignment` (staff, date, shift; UQ per staff per day); `attendance_punch` (append-only in/out, source `self`, `manager` or `kiosk`); `attendance_day` (derived: present, half_day, absent, leave, holiday, week_off; late minutes); `attendance_regularisation` (request → approve) | `attendance_day` is recomputed by a worker job and **frozen once the payroll month is locked**. Holidays reuse `booking.facility_holiday` |
| Leave | `leave_type` (paid or unpaid, annual quota, accrual, carry-forward cap); `leave_ledger` (append-only grant, accrual, consume, reverse, lapse; **balance = Σ**); `leave_request` (`requested` → `approved` / `rejected` / `cancelled`, half-day) | Approval writes consume rows under a lock (no negative balance unless the type allows it) and emits `leave.approved` → booking consumer for doctors |
| Payroll | `salary_component` (earning or deduction; fixed, % of basic or % of gross; statutory codes `pf`, `esi`, `pt`, `tds`); `salary_structure` (versioned per employee, `effective_from`); `payroll_run` (month per facility; `draft` → `computed` → `approved` → `paid` → `locked`); `payslip` and `payslip_line` (snapshots) | Compute = structure × paid days (attendance + paid leave − LOP), plus PF/ESI with configurable caps, a PT slab table per state, and **TDS as a manual monthly amount**. Re-compute only before approval. Approved payslips are immutable. Paid payslips get a bank transfer reference (no bank integration) |

**Routes** `http/routes/hr.ts`:
- **Admin:** `/v1/hr/employees[/:staffId]`, `/v1/hr/shifts`, `/v1/hr/roster`, `/v1/hr/attendance?month`, `/v1/hr/regularisations/:id/approve`, `/v1/hr/leave-types`, `/v1/hr/leave-requests/:id/{approve,reject}`, `/v1/hr/payroll-runs[/:id/{compute,approve,mark-paid,lock}]`, `/v1/hr/payslips/:id`.
- **Self-service:** `/v1/me/attendance/punch`, `/v1/me/attendance`, `/v1/me/leave` (balance and requests), `/v1/me/payslips`.

**Permissions:** `hr.read`, `hr.manage`, `attendance.manage`, `leave.approve`, `payroll.read` (sensitive), `payroll.manage` and `payroll.approve`, plus `attendance.self` and `leave.request`, which go to **every** system role. New system role: `hr_manager`. Self endpoints only ever act on `principal.staffId`.

## Progress

| Step | State |
|---|---|
| Phase 0 platform plumbing | Done: module gate in `runCommand` and worker, switch rules, provisioning rows, docs |
| Billing OPD | Done: `m11_billing`, `090_permissions_billing.sql`, `modules/billing/*`, `routes/billing.ts`, consultation consumers; `billing.test.ts`, `m11-billing.test.ts` |
| Inpatient core | Done: `m07_inpatient`, `100_permissions_inpatient.sql`, `modules/inpatient/*`, `modules/directory/wards.ts`, `routes/inpatient.ts`, encounter consumers; `inpatient.test.ts`, `m07-inpatient.test.ts` |
| Billing IPD | Done: `m11_billing_ipd` (stay account, deposit rule; deposits are advance payments), `modules/billing/stays.ts`, hourly bed-day job, final bill → finance clearance |
| Pharmacy (OPD + IPD) | Done: `m10_inventory`, `m09_pharmacy`, `110_permissions_pharmacy.sql`, `modules/inventory/*`, `modules/pharmacy/*`, `routes/inventory.ts`, `routes/pharmacy.ts`, dispense charge consumers; `pharmacy.test.ts`, `m09-m10-pharmacy.test.ts` |
| HR | Done: `m18_hr`, `120_permissions_hr.sql`, `modules/hr/*`, `modules/booking/leave-closures.ts`, `routes/hr.ts`, leave/exit consumers; `hr.test.ts`, `m18-hr.test.ts`. ERD: `docs/design/erd-v2/m18-hr.md` |

Deviations from the plan text above: attendance is derived on punch, roster change, leave decision and payroll compute (no separate nightly job); half-day leave does not close a doctor's calendar; medicines are billed GST-inclusive (MRP includes tax; `charge.is_tax_inclusive`); no separate pharmacist verification step; no separate `deposit` table (a deposit is a `payment` with `is_advance`); an admission's encounter is linked by `clinical.encounter.admission_id`; the admitting doctor gets chart access as the encounter's attending participant (no separate care assignment).

## Order of work and files

**Phase order:**
1. Phase 0, platform plumbing.
2. Billing OPD.
3. Inpatient core: beds setup, admission, transfer, discharge.
4. Billing IPD: accounts, deposits, bed-day job, interim statement, final bill and finance clearance.
5. Inventory + Pharmacy OPD: Rx, dispense, OTC.
6. Pharmacy IPD: inpatient orders, indents, MAR and pharmacy clearance.
7. HR: profiles → attendance → leave → payroll.

Each step can be merged on its own.

For each phase, in this order: migration → reference seed → `pnpm db:reset && pnpm db:codegen` → module commands and reads → routes → consumers → tests → docs (`docs/api/README.md`).

Representative new files:
- `apps/api/src/modules/billing/charges.ts`
- `apps/api/src/http/routes/billing.ts`
- `apps/api/src/http/billing.test.ts`
- `db/tests/m11-billing.test.ts`

Inventory, pharmacy and HR follow the same pattern.

Work on a new branch. The working tree already has unrelated uncommitted voice and deploy changes (`apps/api/src/config.ts`, `server.ts`, `control-api/*`, `deploy/production/*`). Don't touch or commit them, and merge carefully around `server.ts`.

## Verification

- `pnpm db:reset --test`, `pnpm typecheck`, `pnpm test`. The conventions test must pass for all new schemas (RLS, composite FKs, indexes, single writer).
- DB tests for: never posting a charge twice; immutable issued invoices; consecutive invoice numbers under concurrency; stock never negative; FEFO; price never above MRP; leave balance never negative; locked payroll month.
- HTTP flow tests (`test-kit.ts`, `k.dispatch()` to run consumers):
  1. Book → check in → consultation charge → invoice (bill of supply) → cash payment → receipt → day close.
  2. Receive stock → doctor Rx → sign → dispense → stock down → charge lines → tax invoice → partial return → credit note.
  3. OTC sale refuses an H1 drug.
  6. **IPD:** admit to bed (encounter opened, billing account opened, deposit taken) → a second admit to the same bed is refused → transfer → bed-day job run twice for 3 days posts exactly 3 days per rule → nurse indent → dispense to ward → charge on the account → MAR dose with a witness for an H1 drug, and a duplicate scheduled dose refused → interim statement → plan discharge → departure blocked while finance is pending → final invoice applies the deposit → settle → finance cleared → departure → bed dirty → ready.
  4. Doctor leave approved → `schedule_exception` created and affected appointments flagged.
  5. Month attendance + LOP → payroll compute → approve → lock → payslip in `/v1/me/payslips`.
- Module gating: with `billing` set to `configured`, all `/v1/billing/*` routes return 422 `module_inactive`, and consumers skip. Turning on `pharmacy` also turns on `inventory`. Turning on `inpatient` while billing is inactive is refused.
- DB tests for the inpatient invariants: one occupant per bed, one primary bed per admission, bed-day charges never doubled, departure requiring every clearance.
- Provisioning: a fresh `provision-tenant.mjs` dev tenant has the new `module_state` rows as `configured`.

## Open decisions (defaults assumed above)

1. Per-plan entitlement (Launch, Connect, Scale) for each module. Default: all plans entitled, off until the admin enables them.
2. GST, PT-slab and PF/ESI seed values need a chartered accountant's confirmation, as the ERD already notes for GST.
3. Default bed-day counting method per facility (midnight census assumed) and whether a doctor's daily visit fee is auto-charged. Default: manual charge.
4. PDFs (invoice, receipt, payslip, discharge summary) are deferred until the frontend and documents storage exist; the backend returns print-ready JSON.
