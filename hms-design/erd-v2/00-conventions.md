# 00 — Conventions (apply to every module)

Target: **PostgreSQL 18**, standalone (no Medplum — see README §Medplum decision), modular monolith, India (ABDM, GST, DPDP Act 2023 + DPDP Rules 2025).

## Modules and schemas
- Each module owns one PostgreSQL schema (`platform`, `patient`, `catalog`, `booking`, `clinical`, `diagnostics`, `inpatient`, `theatre`, `pharmacy`, `inventory`, `billing`, `insurance`, `comms`, `documents`, `operations`, `integration`, `abdm`).
- **One writer per schema**: each module's database role has INSERT/UPDATE only on its own schema; other modules read its tables/views or call its commands.
- **Real foreign keys across schemas are allowed and preferred** (v2 enhancement over the "typed IDs only" rule). Write ownership is enforced by grants, integrity by FKs. Typed `(source_type, source_id)` pairs are used only where a link is genuinely polymorphic: `work_task.source`, `audit_event.subject`, `outbox_event.aggregate`, `document.owner`, `charge.source` (charge also keeps typed nullable FKs, see M11).

## Standard columns (every table unless noted)
| Column | Rule |
|---|---|
| `id uuid` | PK, `DEFAULT uuidv7()` (time-ordered) |
| `tenant_id uuid NOT NULL` | In every unique index and every FK: `UNIQUE (tenant_id, id)`; FKs are composite `(tenant_id, x_id)` |
| `created_at`, `created_by`, `updated_at`, `updated_by` | `timestamptz` UTC; `*_by` → `platform.staff` or system actor |
| `version int NOT NULL DEFAULT 1` | Optimistic locking: every UPDATE has `WHERE version = :read_version` and increments it |
| `deleted_at` | Only on reference/master data. Clinical, financial and stock records are never deleted — they are cancelled, reversed, amended or marked `entered_in_error` |

Child/line tables inherit tenant via FK but still carry `tenant_id` (needed for RLS and composite FKs).

## Tenancy
- **Shared database + Row-Level Security** (decision D1): every table has `tenant_id`; policy `tenant_id = current_setting('app.tenant_id')::uuid`.
- Because `tenant_id` is in every key, a large customer can be moved to a dedicated database later without schema changes (the AGNOSTIC doc's "one DB per customer" stays possible).

## History, audit and events
1. **History is never overwritten.** Signed notes, released reports and finalised invoices amend into new versions; stock and money reverse with new rows; status changes write `*_status_history`.
2. **Mutation + `audit_event` + `outbox_event` commit in one transaction.** An audit insert failure fails the command.
3. **Idempotency:** every command carries an idempotency key, stored in `platform.idempotency_record` (same key + different request hash → rejected).
4. **Consumers are idempotent:** `integration.inbox_record (consumer, event_id)` unique.

## Data types
| Kind | Type |
|---|---|
| Money | `bigint` **minor units (paise)** + `currency char(3)` DEFAULT `INR`. GST computed per line, rounded half-up to paise; invoice-level `round_off_minor` |
| Quantities | `numeric(14,3)` in the item's **base unit** |
| Event time | `timestamptz` (UTC) |
| Schedule time | `time` local + facility IANA timezone (`Asia/Kolkata`) |
| Ranges | `tstzrange` / `daterange` with exclusion constraints (`btree_gist`) |
| Small fixed enums | `text` + `CHECK` |
| Extensible lists | lookup tables |
| Codes | `catalog.terminology_concept` (SNOMED CT, WHO ICD-10, LOINC, UCUM) |

## Security & privacy
- Sensitive columns (MLC details, PC-PNDT data, HIV/psychiatric flags via `patient_flag`) need extra capabilities and are excluded from general views.
- Files never stored in the DB: `documents.document_version.storage_key` + SHA-256.
- **Aadhaar numbers are not stored** (Aadhaar Data Vault obligation); ABHA is used.
- Retention: `retain_until` on documents and statutory registers; deletion blocked by trigger before that date.

## Naming
- Tables singular `snake_case`; FK columns `<table>_id`; booleans `is_*`/`has_*`; timestamps `*_at`; dates `*_on`; money `*_minor`.
