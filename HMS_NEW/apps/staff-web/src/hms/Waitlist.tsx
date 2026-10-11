// Mounts the original Cancellation waitlist on /v1/waitlist (G11). Reception adds requests, holds a
// freed slot for 15 minutes as an offer, phones the caller and records the answer. Nothing is sent.
import { useMemo } from "react";
import { WaitlistDesk } from "@/modules/BookingOperations";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request } from "./client";
import { useWorkspace } from "./hooks";
import { can } from "./model";
import type { Slot } from "./types";

type Entry = {
  waitlistEntryId: string;
  status: string;
  facilityId: string | null;
  staffId: string | null;
  preferredFrom: string;
  preferredTo: string;
  notes: string | null;
  bookingPartyName: string;
  bookingPartyPhone: string | null;
  patientId: string | null;
  patientName: string | null;
  offer: { offerId: string; slotStart: string; slotEnd: string; expiresAt: string } | null;
};

const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const offerPath = new RegExp(`^/api/v1/admin/waitlist/${uuid}/offer$`, "i"),
  answerPath = new RegExp(`^/api/v1/admin/waitlist-offers/${uuid}/(accept|decline)$`, "i"),
  withdrawPath = new RegExp(`^/api/v1/admin/waitlist/${uuid}/withdraw$`, "i");
const query = (q: Record<string, string>) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
// Indian mobiles may be typed as 10 digits; anything else must already carry its country code.
const e164 = (phone: string) => (/^[6-9]\d{9}$/.test(phone) ? `+91${phone}` : phone);

export function Waitlist() {
  const { me, facility, practitioners } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(() => {
    const at = facility.facilityId;
    return {
      scope: `${me.tenantId}:${at}:${me.staffId}`,
      permissions: {
        role: me.staffType,
        allowed: {
          "appointments.book": can(me, "appointments.book", at),
          "appointments.cancel": can(me, "appointments.cancel", at),
        },
        staff: [],
      },
      unavailableWrite: "This change is not available here.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        const url = new URL(path, location.origin);
        if (url.pathname === "/api/v1/admin/waitlist") {
          const status = url.searchParams.get("status") ?? "";
          const { items } = await request<{ items: Entry[] }>(
            `/v1/waitlist?${query({ facilityId: at, status: status === "active" ? "" : status, staffId: url.searchParams.get("doctor_id") ?? "" })}`,
            { signal },
          );
          return items.map((e) => ({
            id: e.waitlistEntryId,
            patient_name: e.patientName ?? "Patient not linked",
            phone: e.bookingPartyPhone ?? "",
            doctor_id: e.staffId ?? "",
            branch_id: e.facilityId ?? at,
            consultation_type: "",
            start_date: e.preferredFrom,
            end_date: e.preferredTo,
            status: e.status,
            notes: e.notes,
            booked_by: { name: e.bookingPartyName, phone: e.bookingPartyPhone, patient_linked: !!e.patientId },
            offer: e.offer && {
              id: e.offer.offerId,
              starts_at: e.offer.slotStart,
              ends_at: e.offer.slotEnd,
              expires_at: e.offer.expiresAt,
            },
          })) as T;
        }
        if (url.pathname === "/api/v1/admin/doctors")
          return practitioners.map((p) => ({ id: p.staffId, name: p.name })) as T;
        if (url.pathname === "/api/v1/availability") {
          const doctor = url.searchParams.get("doctor_id") ?? "",
            on = url.searchParams.get("start_date") ?? "";
          if (!new RegExp(`^${uuid}$`, "i").test(doctor)) throw new Error("Choose a doctor.");
          const { items } = await request<{ items: Slot[] }>(
            `/v1/practitioners/${doctor}/slots?${query({ facilityId: at, from: on, to: on })}`,
            { signal },
          );
          const now = Date.now();
          return {
            slots: items
              .filter((s) => s.status === "free" && s.facilityId === at && Date.parse(s.slotStart) > now)
              .map((s) => ({ starts_at: s.slotStart, ends_at: s.slotEnd })),
          } as T;
        }
        throw new Error("Not available on this page.");
      },
      async write<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
        const b = (options.body ?? {}) as Record<string, string>;
        if (options.method !== "POST") throw new Error("Not available on this page.");
        if (path === "/api/v1/admin/waitlist")
          return request<T>("/v1/waitlist", {
            method: "POST",
            idempotencyKey: b.idempotency_key,
            body: {
              facilityId: at,
              staffId: b.doctor_id,
              preferredFrom: b.start_date,
              preferredTo: b.end_date,
              bookingParty: { name: b.patient_name.trim(), phone: e164(b.phone) },
              ...(b.notes?.trim() ? { notes: b.notes.trim() } : {}),
            },
          });
        let m = offerPath.exec(path);
        if (m)
          return request<T>(`/v1/waitlist/${m[1]}/offer`, {
            method: "POST",
            idempotencyKey: b.idempotency_key,
            body: { slotStart: b.starts_at },
          });
        if ((m = answerPath.exec(path)))
          return request<T>(`/v1/waitlist-offers/${m[1]}/${m[2]}`, {
            method: "POST",
            ...(m[2] === "accept" ? { idempotencyKey: b.idempotency_key } : {}),
          });
        if ((m = withdrawPath.exec(path)))
          return request<T>(`/v1/waitlist/${m[1]}/withdraw`, {
            method: "POST",
            body: { reason: b.reason },
          });
        throw new Error("Not available on this page.");
      },
    };
  }, [me, facility, practitioners]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <WaitlistDesk />
    </OriginalResourceContext.Provider>
  );
}
