# Production deployment

The production topology keeps compute and data on separate VPN hosts:

- `10.0.0.5`: platform and one isolated `app` container per tenant.
- `10.0.0.1`: one isolated PostgreSQL container and volume for the control plane and for every tenant,
  plus the VPN-only NFS export used by tenant communication files.
- `/srv/gateway` on `10.0.0.5`: the shared nginx gateway and host-managed Certbot certificates.

`platform.compose.yml` publishes only to `127.0.0.1:8111`. `tenant.compose.yml` publishes each
tenant on a separate loopback port. `data.compose.yml` binds PostgreSQL only to the database
server's VPN address; no database port is bound to its public interface. The tenant data volume is
an NFS-backed Docker volume whose export also lives on `10.0.0.1`, so `10.0.0.5` has no persistent
clinical or communication data volumes.

Tenant production startup is deliberately split into `migrate` and `app`. The short-lived migration
container receives the database-owner credential, runs idempotent migrations and bootstrap, and
exits. The long-running app receives only the restricted `hms_app` login.

The current development staff login must be protected at the gateway before a tenant hostname is
made public. For a real customer, switch to OIDC and build the staff bundle with the customer's OIDC
settings. Each tenant also needs a DNS hostname such as `clinic.health.exora.solutions`; use a
wildcard DNS record and wildcard certificate, or create and certify hostnames during onboarding.
