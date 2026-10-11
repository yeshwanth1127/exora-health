# PRD: Workspace settings and activity log (G16, G18, part of G17)

Status: approved in chat on 11 October 2026 with three decisions: accounts link **by email on first sign-in**; roles are shown read-only **and** can be customised; the **activity log** is included. Ledger: G16, G18 (log and export), G17 (overbooking only). UI rows: UI-settings-01..04, UI-activity-01/02. Schema: the m01 tables already exist. One small migration lets an invited login wait for its first sign-in (see Rules).

## Problem

Settings today shows only your own name and a list of permission codes. An administrator can't add a receptionist, give a doctor access to a second clinic, or switch someone off when they leave. Today all of that needs a database script. The original Settings page had staff accounts, password change, per-permission switches, the overbooking policy and optional modules. HMS_NEW signs in through an identity provider (OIDC) and uses roles granted per clinic, so those screens can't be wired as they were.

## Goal

An administrator manages who can use the workspace and what they can do at each clinic, from the original Settings layout. Every change is audited and takes effect on the person's next request. Nobody can give out more access than they hold.

## Scope

In:
- **Your account:** name, staff type, and your roles per clinic, shown in plain words instead of permission codes. Password change is replaced by "Your sign-in is managed by your hospital's sign-in provider". HMS never handles passwords.
- **Sign-in by email invite:** the administrator enters the person's work email. The login waits as *invited* until that person first signs in with the same email, and the sign-in provider must mark it verified. HMS then links that sign-in to the invite.
- **Staff accounts** (original table): name, staff type, sign-in, roles per clinic, status. The list is filtered to the clinics you manage.
- **Add staff member** (original dialog, adapted):
  - Fields: full name, employee number, staff type, work email, phone (optional), first role and clinic.
  - Creates the staff record, an invited login and the role grant in one step.
- **Change access:** grant a role at one clinic or at every clinic, or remove a grant with a reason.
- **Deactivate / reactivate** a staff member with a reason. Deactivating blocks every request from their next one on.
- **Roles** tab (original "What clinic staff can change"):
  - Shows every role's permissions in plain words.
  - Built-in roles are read-only. **Make a copy** creates a clinic-owned role that can be edited with the original switches and granted like any other.
- **Activity log** (original page): who did what to which record, and when, with filters for person, record, action and dates, and **Export CSV** (up to 5,000 rows, itself audited). Only completed changes are recorded, so the original "rejected" outcome filter is dropped.
- **Appointment booking policy** card (original): the clinic's overbooking switch, using the existing `GET/PUT /v1/facilities/:id/overbooking`.

Out:
- Editing the built-in roles in place (they're shared by every hospital). Renaming or retiring a custom role.
- Optional modules (G17 module switches). The original modules are WhatsApp, Voice and growth tools, which have no backend yet.
- Demo controls (local data reset is a dev script, not a workspace feature).
- Care assignments and break-glass review (G16 remainder, G18).
- Sending the invite email (the administrator tells the person). Break-glass review (G18 remainder). MFA enrolment belongs to the sign-in provider.
- Doctor booking profiles for new doctors (affiliation, hours, fees: G14).

## User flows

1. Priya (administrator, every clinic) opens Settings → Staff accounts → **Add staff member**. She enters "Kiran", employee number "FD-014", Front desk, work email `kiran@clinic.example`, Branch 1. Kiran signs in with that verified email and sees only Branch 1 front-desk screens.
2. Dr Asha starts at Branch 2 on Tuesdays. Priya opens her row → **Add access** → Doctor at Branch 2. Asha's next page load shows Branch 2.
3. Kiran leaves. Priya clicks **Deactivate** and gives a reason. Kiran's next request is refused (403).
4. A Branch 1 administrator sees only Branch 1 staff and grants, and can't grant "every clinic" access.
5. Priya copies Front desk as "Senior front desk", switches on "Edit schedules", and grants it to Ravi.
6. An auditor filters the activity log to one appointment and exports it.

## API (all `/v1`, writes through `runCommand` and audited; create commands take `Idempotency-Key`)

| Route | Permission |
|---|---|
| `GET /v1/me` (exists) | signed in |
| `GET /v1/roles` | `access.manage` (any clinic): system and tenant roles with their permissions, and the permission list |
| `POST /v1/roles` `{name, copyOfRoleId}` | `access.manage` at every clinic; you must hold every permission being copied |
| `PUT /v1/roles/:roleId/permissions/:code` `{allowed}` | `access.manage` at every clinic; custom roles only; you can switch on only permissions you hold at every clinic |
| `GET /v1/audit-events?actor&record&action&from&to&limit` | `audit.read` at every clinic |
| `POST /v1/audit-events/export` (same filters) | `audit.read` at every clinic; recorded as an `export` audit event |
| `GET /v1/staff-accounts?facilityId` | `access.manage` at that clinic: staff with any grant there or at every clinic, their grants, sign-in status |
| `POST /v1/staff-accounts` | `staff.manage` and `access.manage` at the first grant's clinic (every clinic if none chosen) |
| `POST /v1/staff/:staffId/grants` `{roleId, facilityId \| null}` | `access.manage` at that clinic (null: every clinic) |
| `POST /v1/role-grants/:grantId/revoke` `{reason}` | `access.manage` at the grant's clinic (null: every clinic) |
| `POST /v1/staff/:staffId/status` `{status: active \| inactive, reason}` | `staff.manage` at every clinic where the person holds a grant |
| `GET/PUT /v1/facilities/:id/overbooking` (exists) | `appointments.read` / `config.manage` at that clinic |

No new permissions. `staff.manage` and `access.manage` are already seeded, and only `tenant_admin` holds them.

## Rules (security)

- **No escalation.** You can grant a role at a clinic only if you yourself hold every permission in that role at that clinic, or at every clinic for an every-clinic grant. A Branch 1 administrator can't create an every-clinic administrator.
  - The one exception is emergency chart access (`break_glass.use`). Whoever reviews its use at that clinic (`break_glass.review`) may grant it without holding it. Otherwise no administrator could set up a doctor, because the built-in Administrator role deliberately lacks it.
  - Nobody grants roles to themselves.
- **No lockout.** You can't revoke your own `access.manage` grant or deactivate yourself. The last active every-clinic `access.manage` holder in the tenant can't be revoked or deactivated. Access changes in a tenant run one at a time (transaction advisory lock), so two administrators can't remove each other at the same moment.
- **System and integration accounts** (`is_system_account`, the `booking_agent` role) are not listed, granted or changed here.
- **Email linking:**
  - An invite links only when the sign-in token carries the same email **and** `email_verified: true`, from the one configured issuer.
  - It links only invites that are still unlinked, for staff who are active, in tenants where this identity has no account yet. The link is audited.
  - Work emails are unique per hospital. A wrong email gives that address's owner access, so the dialog asks the administrator to confirm it.
  - Migration: `identity_issuer`/`identity_subject` may be null only while the login is *invited*. Staff emails get a per-tenant unique index.
- **Revoking** sets `revoked_at`/`revoked_by` and keeps the row (history). Reactivating someone doesn't restore revoked grants.
- **Role switches** can't remove `access.manage` if that would leave nobody with it at every clinic.
- **Every write is audited** with the reason.
- **The activity log** spans every clinic and includes patient record ids, so it needs `audit.read` at every clinic. CSV cells that begin with `= + - @` are prefixed with an apostrophe, so a spreadsheet can't run them as formulas.
- **The frontend** hides controls without the permission, and the server enforces the same rules.

## Acceptance criteria

- Priya invites a front-desk user at Branch 1. A dev sign-in with that verified email links the account, and the user is limited to Branch 1.
- An unverified email, or a deactivated staff member, does not link.
- Granting Doctor at Branch 2 shows Branch 2 on the doctor's next load. Revoking it removes it.
- Deactivating gives 403 on the person's next request. Reactivating restores their remaining grants.
- A Branch 1 administrator: can't read Branch 2 staff (403), can't grant every-clinic access (403), and can't grant a role holding permissions they lack (403).
- You can't revoke your own `access.manage` grant or deactivate yourself (409). The last every-clinic admin is protected.
- Front desk and nurse get 403 on every write. Settings shows them only their own account.
- A copied role can be edited and granted. Built-in roles can't be edited (409). Switching on a permission you lack gives 403.
- The activity log filters work; export returns at most 5,000 rows and appears in the log itself; non-auditors get 403.
- A duplicate employee number or email gives 409, and a retry with the same key returns the same staff member.
- Backend suite, root typecheck and frontend checks pass. A security review is recorded here before commit.
