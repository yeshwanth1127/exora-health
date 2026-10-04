# Production deployment

The public Nginx server is `10.0.0.5`. It reaches the private Docker host at
`10.0.0.1` through the existing `qlix-agent` SSH alias. The production stack
lives in `/opt/exora-health` on the Docker host.

## One-time provisioning

1. Copy `compose.production.yml`, `remote-deploy.sh`, and the voice model
   directory to `/opt/exora-health` on `10.0.0.1`.
2. Copy `.env.production.example` to `/opt/exora-health/.env`, replace every
   placeholder, and set mode `0600`.
3. Authenticate Docker to GHCR with a read-only package token.
4. Install `nginx-avocado.conf` on `10.0.0.5`, but switch traffic only after
   direct health checks against ports 18004, 15567, and 18765 succeed.
5. Configure the GitHub `production` environment with `DEPLOY_HOST`,
   `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`.

The deployment script backs up PostgreSQL, applies Alembic migrations, replaces
the three application containers, checks their health, and restores the prior
application image tags if the new release is unhealthy. Database migrations
must remain backward compatible because application rollback does not reverse
database schema changes.

The backend image also carries `compose.production.yml` and
`remote-deploy.sh`. On every release, the installed deployment script extracts
those files from the exact candidate image, validates them against the private
server `.env`, deploys with the staged Compose file, and promotes the files only
after all health checks pass. Updating the installed script to a version with
this bootstrap logic is a one-time provisioning step; later configuration and
script changes require no manual server copy.
