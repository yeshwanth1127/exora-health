import type { GrowthApi } from "../modules/growth/GrowthModule";
import {
  BookingLinkInputSchema,
  BookingLinkSchema,
  BookingLinksSchema,
  LinkChangesSchema,
  GrowthCapabilitiesSchema,
  GrowthSummarySchema,
  WebsiteActivitySchema,
} from "@hms/contracts";
import { today } from "./model";
import { HmsError, IntentKeys, query, request } from "./client";
import type { Facility, Me } from "./types";

export function growthSource(_me: Me, facility: Facility): GrowthApi {
  const keys = new IntentKeys(),
    versions = new Map<string, number>();
  const at = facility.facilityId;
  const link = (v: {
    facilityId: string;
    bookingUrl: string;
    updatedAt: string;
    version: number;
  }) => {
    versions.set(v.facilityId, v.version);
    return {
      branch_id: v.facilityId,
      booking_url: v.bookingUrl,
      updated_at: v.updatedAt,
    };
  };
  return async <T>(
    path: string,
    options?: { method?: string; body?: unknown },
  ) => {
    const url = new URL(path, "http://local");
    const end = today(facility.timezone),
      start = new Date(Date.parse(end) - 29 * 86400000)
        .toISOString()
        .slice(0, 10);
    const from = url.searchParams.get("start_date") || start,
      to = url.searchParams.get("end_date") || end;
    const selected = url.searchParams.get("branch_id");
    if (selected && selected !== at)
      throw new HmsError("Choose the current clinic.", 403, "forbidden");
    if (url.pathname.endsWith("/growth/catalogue"))
      return {
        branches: [
          {
            id: at,
            name: facility.name,
            slug: facility.code,
            is_active: facility.status !== "inactive",
            is_virtual: facility.facilityType === "virtual",
          },
        ],
      } as T;
    if (url.pathname.endsWith("/google/booking-links")) {
      const d = BookingLinksSchema.parse(
        await request(`/v1/booking-links?${query({ facilityId: at })}`),
      );
      return { links: d.items.map(link) } as T;
    }
    if (url.pathname.endsWith("/google/capabilities")) {
      const d = GrowthCapabilitiesSchema.parse(
        await request(`/v1/growth/capabilities?${query({ facilityId: at })}`),
      );
      return { capabilities: d.items } as T;
    }
    if (url.pathname.endsWith("/google/changes")) {
      const d = LinkChangesSchema.parse(
        await request(`/v1/booking-links/changes?${query({ facilityId: at })}`),
      );
      return d.items.map((v) => ({
        id: v.id,
        branch_id: v.facilityId,
        actor: v.actorName,
        actor_name: v.actorName,
        action: "booking_link_updated",
        change: { before: v.before, after: v.after },
        created_at: v.createdAt,
      })) as T;
    }
    const match = url.pathname.match(
      /\/google\/booking-links\/([0-9a-f-]{36})$/i,
    );
    if (match && options?.method === "PUT") {
      if (match[1] !== at)
        throw new HmsError("Choose the current clinic.", 403, "forbidden");
      const body = options.body as { booking_url: string };
      const data = BookingLinkInputSchema.parse({
        bookingUrl: body.booking_url,
        version: versions.get(at) ?? 0,
      });
      const d = BookingLinkSchema.parse(
        await request(`/v1/facilities/${at}/booking-link`, {
          method: "PUT",
          body: data,
          idempotencyKey: keys.for(path, data),
        }),
      );
      keys.complete(path, data);
      return link(d) as T;
    }
    if (url.pathname.endsWith("/growth/summary")) {
      const d = GrowthSummarySchema.parse(
        await request(
          `/v1/growth/summary?${query({ facilityId: at, from, to, cohort: url.searchParams.get("cohort") || "created" })}`,
        ),
      );
      return {
        filters: {
          start_date: d.from,
          end_date: d.to,
          timezone: d.timezone,
          cohort: d.cohort,
        },
        summary: {
          appointments_in_cohort: d.appointmentsInCohort,
          retained_confirmation_share: d.retainedConfirmationShare,
          attendance_rate_resolved: d.attendanceRateResolved,
        },
        by_status: d.byStatus,
        by_channel: d.byChannel,
        by_acquisition_source: d.byAcquisitionSource,
        sources: d.sources,
      } as T;
    }
    if (url.pathname.endsWith("/growth/website-activity")) {
      const d = WebsiteActivitySchema.parse(
        await request(
          `/v1/growth/website-activity?${query({ facilityId: at, from, to, traffic: url.searchParams.get("traffic") || "production" })}`,
        ),
      );
      return {
        status: d.status,
        traffic: d.traffic,
        rows: d.rows,
        filters: { start_date: d.from, end_date: d.to, timezone: d.timezone },
        retrieved_at: d.retrievedAt,
      } as T;
    }
    throw new HmsError(
      "This growth action is unavailable.",
      501,
      "backend_pending",
    );
  };
}
