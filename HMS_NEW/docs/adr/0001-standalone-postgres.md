# ADR 0001 — Standalone PostgreSQL instead of Medplum

- Status: accepted
- Date: 2026-10-09

## Context
The earlier migration plan made Medplum (a FHIR R4 server) the owner of clinical records, with operational data (booking, billing, stock) in SQL. The plan-alignment review showed every cross-store link (charge → order, dispense → batch) would need a resource map and reconciliation, and that Medplum's transaction bundles and reference checks were disabled in the demo.

## Decision
One PostgreSQL 18 database is the single source of truth for all modules. FHIR R4 is produced as a projection only where required: ABDM health-record exchange (M17, NRCeS profiles) and NHCX claims (M12).

## Consequences
- One transaction covers chart, charge, stock, audit and outbox; real FKs and constraints across modules.
- We build versioning (`*_version` tables), access control (`role_grant`, `care_assignment`, RLS) and a FHIR projection (`abdm.fhir_resource_map`) ourselves.
- India-specific registers (MLC, PC-PNDT, H1) are first-class tables, not FHIR extensions.
- A public FHIR API, if ever needed, is built on the projection.
