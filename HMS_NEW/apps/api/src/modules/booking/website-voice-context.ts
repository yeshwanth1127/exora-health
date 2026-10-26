import { z } from "zod";
import type { DB, Kysely } from "@hms/db";
import { forbidden, conflict, notFound } from "@hms/platform";
import { authorize, resolvePrincipal } from "../../auth/principal.ts";
import { readSlot, type PublicBookingConfig } from "./public-config.ts";
import {
  publicCatalog,
  publicSlots,
  consumePublicBudget,
} from "./public-booking.ts";
export const WebsiteSlotSelection = z.strictObject({
  site: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
  slotToken: z.string().min(1).max(2000),
});
/** Selection is a preference. Voice must recheck, hold and confirm with its existing tools. */
export async function websiteVoiceContext(
  db: Kysely<DB>,
  config: PublicBookingConfig,
  selection: z.infer<typeof WebsiteSlotSelection>,
  origin: string | undefined,
  ip: string,
) {
  const site = config.sites.find((s) => s.siteSlug === selection.site);
  if (!site) throw notFound("Booking site");
  if (!origin || !site.origins.includes(origin))
    throw forbidden("The selected website is not allowed for this assistant");
  await consumePublicBudget(
    db,
    site,
    config.signingSecret,
    "voice:" + ip,
    600,
    20,
    new Date(),
  );
  const claim = readSlot(selection.slotToken, config.signingSecret);
  if (
    claim.siteSlug !== site.siteSlug ||
    claim.tenantId !== site.tenantId ||
    claim.facilityId !== site.facilityId ||
    claim.expiresAt <= Date.now()
  )
    throw forbidden(
      "The selected time has expired or belongs to another hospital",
    );
  const p = await resolvePrincipal(
    db,
    { issuer: site.identityIssuer, subject: site.identitySubject },
    site.tenantId,
  );
  if (!p.isSystemAccount)
    throw forbidden("A dedicated booking account is required");
  authorize(p, "appointments.read", site.facilityId);
  authorize(p, "appointments.book", site.facilityId);
  const caller = {
    tenantId: p.tenantId,
    actor: {
      kind: "staff" as const,
      staffId: p.staffId,
      userId: p.userAccountId,
    },
    correlationId: "website-voice",
  };
  const catalog = await publicCatalog(db, caller, site);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: catalog.timezone,
  }).format(new Date(claim.startsAt));
  const result = await publicSlots(db, caller, site, config.signingSecret, {
    doctor: claim.doctorSlug,
    mode: claim.visitMode,
    from: day,
    to: day,
  });
  if (
    !result.slots.some(
      (s) =>
        Date.parse(s.startsAt) === Date.parse(claim.startsAt) &&
        Date.parse(s.endsAt) === Date.parse(claim.endsAt) &&
        s.feeMinor === claim.feeMinor,
    )
  )
    throw conflict("This time is no longer available. Choose another slot.");
  return {
    doctor_slug: claim.doctorSlug,
    preferred_start: claim.startsAt,
    preferred_end: claim.endsAt,
    visit_mode: claim.visitMode,
    fee_minor: claim.feeMinor,
    selection_status: "preference_only",
  };
}
