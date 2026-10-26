# Paperwhale SaaS platform plan

## Product boundary

Paperwhale is the SaaS control plane. A customer organisation onboards once and receives an
isolated HMS tenant deployment containing:

- a public clinic website and appointment-booking flow;
- the shared Paperwhale staff workspace, branded and configured for that customer;
- the HMS API and worker;
- a dedicated PostgreSQL database and private persistent volume;
- a dedicated Sarvam voice agent and deployment binding;
- customer-specific modules, plan limits, domains and subscription state.

The Paperwhale control plane owns customer onboarding, subscription state, deployment orchestration,
domains, module entitlements, operator access, audit, health and links. A tenant deployment owns
patient, staff, appointment, clinical and communications data. Tenant clinical data is never copied
into the control plane.

## Isolation model

The first production topology is one Compose project per customer:

```text
Paperwhale control plane
  -> deployment registry
  -> provisioner
       -> tenant app container (public site + staff UI + API + worker)
       -> tenant PostgreSQL container + private volume
       -> tenant secrets + Sarvam binding
```

Every deployment receives a generated deployment ID, Docker network, database credentials,
service keys and hostnames. No tenant container can reach another tenant database or network.
The tenant ID is still retained inside HMS so application-level tenant checks remain a second
boundary rather than being removed because the database is isolated.

The control plane stores operational metadata only: organisation name, owner identity, selected
plan, module entitlements, domains, deployment status, image version and non-secret credential
references. It must not store charts, patient lists, transcripts or appointment bodies.

## Applications

| Application | Responsibility |
|---|---|
| `apps/platform-web` | Paperwhale marketing site, product explanation, sign-in and onboarding journey |
| `apps/control-api` | Operator/customer control plane API; onboarding, plans, subscriptions, deployments and links |
| `apps/staff-web` | Shared tenant staff workspace, themed from tenant configuration |
| `apps/public-web` | Shared tenant public site and appointment flow, themed from tenant configuration |
| `apps/api` | Tenant HMS API |
| `apps/worker` | Tenant outbox and scheduled work |
| `apps/tenant-runtime` | One-process production runtime that serves built web assets and runs API/worker lifecycle |

## Onboarding state machine

1. `account` - owner signs in and verifies work email.
2. `organisation` - legal/display name, slug, country, timezone and currency.
3. `brand` - logo, colours, public copy and contact details.
4. `facility` - first branch, address, hours and visit modes.
5. `services` - departments, services, appointment durations and prices.
6. `team` - first administrator and optional doctors/staff invitations.
7. `channels` - public website domain and optional voice/WhatsApp requests.
8. `plan` - subscription plan, module entitlements and billing contact.
9. `review` - customer confirms data-processing and launch configuration.
10. `provisioning` - immutable onboarding snapshot is queued for the provisioner.
11. `ready` - public and staff URLs plus a one-time administrator activation credential are shown.

Draft steps are resumable. Provisioning is idempotent by onboarding ID. A failed provision remains
inspectable and retryable by a platform operator; it never creates a second tenant silently.

## Identity and access

- Platform operators are separate from tenant staff. A platform operator cannot silently become a
  clinician or read tenant clinical data.
- Support access is explicit, time-bounded, reasoned, approved where required and audited in both
  the control plane and tenant deployment.
- Tenant owners administer only their deployment, staff and enabled modules.
- Initial administrator credentials are random, single-use activation credentials with forced
  password/OIDC enrolment. Static shared default passwords are development-only.
- Every tenant has separate database, OIDC client/audience, service keys and Sarvam secret.

## Subscription and modules

Plans resolve to versioned entitlements, not frontend feature flags. The control plane signs a
short-lived entitlement document for the tenant runtime. The tenant API enforces module state and
plan limits server-side. Subscription suspension blocks new business writes while preserving
exports, authenticated consent withdrawals, provider receipts and operator recovery paths.

Initial plans:

- `launch`: public site, staff, directory, schedules, patients and appointments;
- `connect`: launch plus WhatsApp and Voice;
- `scale`: connect plus growth, multiple facilities and advanced administration.

Plan names and prices remain configurable; code depends on entitlement codes rather than names.

## Tenant provisioning contract

The provisioner accepts a validated onboarding snapshot and produces:

```json
{
  "deploymentId": "dep_...",
  "tenantId": "uuid",
  "slug": "clinic-slug",
  "image": "exora/hms:<version>",
  "publicHost": "clinic-slug.exora.health",
  "staffHost": "staff.clinic-slug.exora.health",
  "modules": ["catalog", "booking"],
  "secretRefs": {},
  "requestedBy": "platform-user-id"
}
```

It creates a tenant-specific Compose project, private network, database volume, health checks and
reverse-proxy routes; runs migrations and a deterministic tenant seed; creates the initial admin;
and records URLs and health. Rollback removes routing and stops containers without deleting the
database volume. Data deletion is a separate delayed, approved operation.

## Delivery phases

1. Product website and resumable onboarding UI.
2. Control-plane schema/API, platform operator UI and subscription entitlements.
3. Single-image tenant runtime containing public site, staff UI, API and worker.
4. Idempotent local Docker provisioner and deployment registry.
5. Tenant-aware theming and public booking application.
6. Sarvam agent template, per-tenant clone/configure/commit/deploy lifecycle and callback adapter.
7. Domains, TLS, email activation and production secret manager.
8. Billing provider integration, plan enforcement, metering and dunning.
9. Backups, restore drills, upgrades, observability and support-access workflow.

## Acceptance gates

- Two provisioned tenants cannot access each other's network, database, IDs, URLs or secrets.
- A platform operator can see deployment health and subscription state but no patient data.
- Onboarding retry is idempotent and resumes from the failed step.
- The public booking flow writes only to its own tenant.
- Staff links reject identities from another tenant.
- Module and subscription changes are enforced by the tenant API, not only hidden in the UI.
- A tenant image upgrade is reversible and preserves its database volume.
- Every Sarvam agent is bound to exactly one tenant, account ID, committed version and service key.
