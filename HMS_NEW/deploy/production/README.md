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

Customer provisioning requires company OIDC and defaults to production mode. Build the staff image
with development login disabled and matching OIDC settings; the runtime refuses an incompatible
bundle. The bootstrap owner receives an invitation linked only after a verified-email sign-in. Each tenant also needs a DNS hostname such as `clinic.health.exora.solutions`; use a
wildcard DNS record and wildcard certificate, or create and certify hostnames during onboarding.

## Automated tenant provisioning

Production onboarding is completed by the host service in `exora-health-provisioner.service`.
The public control API exposes a token-protected claim/complete/fail protocol; the host worker never
receives the super-admin token. For each claimed request it:

1. Calls the forced-command SSH data agent on `10.0.0.1`. The agent allocates a VPN-only PostgreSQL
   port, starts an isolated database container, and creates an NFS export restricted to `10.0.0.5`.
2. Generates tenant secrets under `/srv/apps/exora-health/tenants/<slug>` on `10.0.0.5` and starts
   the tenant container with the restricted `hms_app` database login.
3. Writes a tenant nginx virtual host using the shared `*.health.exora.solutions` certificate,
   validates/reloads the existing gateway, and checks the real public booking bootstrap endpoint.
4. Marks the onboarding request ready and publishes the patient and staff URLs.

The worker waits without claiming requests until the wildcard certificate exists. Configure
`/etc/exora-health/provisioner.env` with `CONTROL_URL`, `PROVISIONER_TOKEN`, `REPO_ROOT`,
`TENANT_ROOT`, `IMAGE_TAG`, `DATA_SSH_TARGET`, `DATA_SSH_KEY`, `GATEWAY_DIR`,
`WILDCARD_CERT_NAME`, and `PROVISION_COMMAND`. The same `PROVISIONER_TOKEN` must be provided to
`platform.compose.yml`.

The database SSH key must use this forced command in `root`'s `authorized_keys` on `10.0.0.1`:

```text
restrict,command="/usr/local/sbin/exora-data-agent" ssh-ed25519 <public-key>
```

The only supported remote command is `provision`, and the agent validates every slug and secret.
Use a Cloudflare-scoped API token with Certbot's DNS plugin to issue and renew a certificate named
`health.exora.solutions-wildcard` for `health.exora.solutions` and
`*.health.exora.solutions`.

## Managed dashboard integrations

Follow [the activation checklist](../../docs/plan/INTEGRATION_SETUP_CHECKLIST.md) before enabling
provider sending. Add the company OIDC/provider settings to the private provisioner configuration.
The provisioner generates and retains each tenant's encryption/signing keys, dedicated booking
identity and origin mapping; the API and worker receive identical provider settings. The image
supervises both processes and restarts if either exits.

`analytics.compose.yml` is an optional private Umami stack for the data host. Supply a pinned
official PostgreSQL-compatible v3 Umami image supporting persistent API keys, a URL-safe database
password and a persistent application secret. Give the application a company-only HTTPS ingress,
change the initial admin password, and generate a server API key before setting `UMAMI_ORIGIN`
and `UMAMI_API_KEY` on HMS. Back up this database as well as the tenant databases; do not put the
Umami console or its database on a public customer endpoint.
