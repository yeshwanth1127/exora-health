# Virtual OPD implementation status

Updated: 2 October 2026

## Implemented and verified

- Isolated backend and frontend branches named `codex/virtual-opd`.
- Existing uncommitted backend voice-integration changes preserved in the implementation worktree.
- Alembic split heads merged and a clean migration from an empty database verified.
- Existing rows assigned to a default hospital during migration.
- Hospital, user, membership, server-side session, patient, and doctor-login relationships.
- Scrypt password hashing, opaque hashed sessions, secure-cookie configuration, expiry, revocation, and named administrator sessions.
- Development seed accounts and a controlled production administrator bootstrap command.
- Browser admin-key login removed; API key retained only as a backend break-glass compatibility path.
- Tenant-scoped public catalogue, administration, booking ownership, and negative isolation tests.
- Production booking requires an authenticated patient.
- Virtual appointment automatically creates one HMS-owned teleconsultation.
- Versioned consent, waiting-room check-in, assigned-doctor start, patient/doctor join grants, explicit completion, audit events, and outbox events.
- Opaque Jitsi room names and five-minute HMS-minted participant/moderator JWTs.
- Patient and doctor Virtual OPD portal at `/virtual-opd` with device check, waiting, polling, embedded Jitsi, reconnect, and completion UI.
- Main patient portal and admin dashboard now use the real backend session.
- Virtual booking confirmation links into Virtual OPD.
- Voice agent retains backend-owned virtual booking and gives correct waiting-room/consent instructions; its Compose file now includes backend service configuration.
- Backend and frontend CI workflows, frontend production container, Nginx SPA fallback, health check, and cache/security headers.

Verification:

- Backend: 17 tests pass.
- Backend migration: clean upgrade reaches the single `0005_identity_virtual_opd` head.
- Frontend: TypeScript and Vite production build pass.
- Voice agent: 82 tests pass.

## External production dependencies still required

These cannot be completed truthfully from the three inspected repositories alone:

1. Production Jitsi choice and credentials: domain, self-hosted versus managed service, issuer/audience/app ID, signing-key format, TURN endpoints, region, and capacity target.
2. The real Exora clinical system: encounter, notes, prescription, investigation, follow-up, and patient-document APIs/schema are absent. The portal currently returns explicit `null` clinical capabilities rather than fabricating records.
3. Hosting platform: no AWS/GCP/Azure/on-prem/Kubernetes/ECS target, DNS zones, TLS ownership, secrets manager, registry, or production environment exists in the supplied repositories.
4. Notification vendors: no approved SMS/email/WhatsApp provider credentials, templates, sender identities, or delivery webhook contract was supplied.
5. Compliance decisions: operating jurisdictions, approved consent text, retention schedule, data residency, recording policy, incident notification contacts, and privacy/security approvers.
6. Operational targets: expected hospitals/users/concurrent calls, availability SLO, RPO/RTO, support hours, on-call system, and monitoring vendor.
7. Production identity policies: approved MFA method/provider and patient account activation/recovery channel.

The code is an executable MVP foundation with production-oriented authorization boundaries. It must not be described as production-ready until the external dependencies above are selected, integrated, exercised, and signed off under the release gates in `VIRTUAL_OPD_IMPLEMENTATION_PLAN.md`.
