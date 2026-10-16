// Company operator check. Never returns credentials, URLs, tenant IDs or account identifiers.
import { config } from "../db/scripts/config.mjs";
import { createDb, sql } from "../packages/db/src/index.ts";
import { loadManagedSettings } from "../apps/api/src/modules/comms/managed-config.ts";
const checks: Record<string, boolean> = {};
try {
  const s = loadManagedSettings();
  checks.secureConnections = !!s.encryptionKey && !!s.publicOrigin;
  checks.whatsapp = !!s.meta && !!process.env.WA_VERIFY_TOKEN;
  checks.whatsappSending = !!s.whatsappSending;
  checks.whatsappBooking = !!s.booking?.sites.length;
  checks.googleBusiness = !!s.google;
  checks.websiteAnalytics = !!s.umami;
  checks.posthogOptional = !!s.posthog;
} catch {
  console.error(
    "Integration configuration is incomplete or invalid. Check the company deployment guide.",
  );
  process.exitCode = 2;
}
const db = createDb({
  connectionString: config.appDatabaseUrl,
  maxConnections: 1,
});
try {
  const {
    rows: [r],
  } = await sql<{
    ready: boolean;
  }>`SELECT to_regclass('comms.managed_connection') IS NOT NULL AND to_regclass('comms.managed_automation') IS NOT NULL AND to_regclass('comms.managed_broadcast') IS NOT NULL AND to_regclass('comms.booking_attribution') IS NOT NULL AND to_regclass('comms.google_scheduled_post') IS NOT NULL AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='comms' AND table_name='managed_automation' AND column_name='enabled_at') AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='comms' AND table_name='inbound_message' AND column_name='phone_number_id') AS ready`.execute(
    db,
  );
  checks.database = !!r?.ready;
} catch {
  checks.database = false;
} finally {
  await db.destroy();
}
const ready = [
  "secureConnections",
  "whatsapp",
  "whatsappSending",
  "whatsappBooking",
  "googleBusiness",
  "websiteAnalytics",
  "database",
].every((key) => checks[key] === true);
console.log(
  JSON.stringify(
    {
      ready,
      checks,
      liveProviderVerification: "not performed",
      next: ready
        ? "Deploy API and worker, then complete dashboard consent and provider readback."
        : "Complete company provisioning; see docs/plan/MANAGED_DASHBOARD_INTEGRATIONS.md.",
    },
    null,
    2,
  ),
);
if (!ready) process.exitCode = 2;
