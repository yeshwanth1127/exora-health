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
the application containers, checks their health, and restores the prior
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

## WhatsApp Cloud API

The public Meta callback is `https://avocado.exora.solutions/whatsapp/webhook`.
The WhatsApp container listens only on the private Docker host at port 18787;
the public Nginx server proxies the exact callback path. Put Meta credentials in
`/opt/exora-health/.env` on the Docker host, never in Git. `WA_VERIFY_TOKEN` is
the value entered beside the callback URL in Meta. Subscribe the WhatsApp
Business Account webhook to the `messages` field after `/health/ready` passes.
The deployed single bot uses inline signed-webhook processing because the
current backend does not expose the optional durable inbound queue. Booking and
conversation state remain persisted in PostgreSQL; keep exactly one bot replica.
The current configured Meta phone-number ID is a Meta test number, so the bot is
reachable only by recipients allowed in Meta's test console. Replace it with the
registered clinic phone-number ID and set `WA_ALLOW_META_TEST_NUMBER=false` for
public production use.
