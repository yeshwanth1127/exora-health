import { useState } from "react";
import { BookingReadinessSchema, type BookingReadiness } from "@hms/contracts";
import { query } from "./client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { addDays } from "./forms";
import { Choice, Status } from "./ui";
import { deriveSetup, type Evidence } from "./setup-readiness";
import type {
  ClinicDirectory,
  FacilityDetail,
  Practitioner,
  PriceBookItem,
  Session,
  Slot,
} from "./types";
function evidence<T>(
  r: { loading: boolean; error: string; data: T | null },
  allowed: boolean,
): Evidence<T> {
  if (!allowed || r.error) return { state: "unknown" };
  if (r.loading) return { state: "loading" };
  return r.data === null
    ? { state: "unknown" }
    : { state: "known", value: r.data };
}
function rows<T>(e: Evidence<{ items: T[] }>): Evidence<T[]> {
  return e.state === "known" ? { state: "known", value: e.value.items } : e;
}
/** Configuration evidence only. Never creates holds, bookings, staff or provider connections. */
export function SetupGuide() {
  const { facility, can, go } = useWorkspace();
  const [expanded, setExpanded] = useState<boolean | null>(null),
    [mode, setMode] = useState<"in_person" | "virtual">("in_person"),
    [selected, setSelected] = useState(""),
    [activeItem, setActiveItem] = useState("");
  const day = today(facility.timezone),
    until = addDays(day, 30);
  const admin = [
    "facility.manage",
    "catalog.manage",
    "pricing.manage",
    "schedules.manage",
  ].some(can);
  const readCatalog = admin && can("catalog.read"),
    readHours = admin && can("appointments.read");
  const doctors = useQuery<{ items: Practitioner[] }>(
    readCatalog ? `/v1/practitioners?facilityId=${facility.facilityId}` : null,
  );
  const practitioners =
    doctors.data?.items.filter((p) => p.facilityId === facility.facilityId) ??
    [];
  const doctor =
    practitioners.find((p) => p.staffId === selected) ??
    practitioners[0] ??
    null;
  const clinic = useQuery<FacilityDetail>(
    readCatalog ? `/v1/facilities/${facility.facilityId}` : null,
  );
  const directory = useQuery<ClinicDirectory>(
    readCatalog ? `/v1/facilities/${facility.facilityId}/directory` : null,
  );
  const prices = useQuery<{ items: PriceBookItem[] }>(
    readCatalog
      ? `/v1/facilities/${facility.facilityId}/price-book?on=${day}`
      : null,
  );
  const sessions = useQuery<{ items: Session[] }>(
    readHours && doctor?.calendarId
      ? `/v1/practitioners/${doctor.staffId}/sessions?from=${day}&to=${until}`
      : null,
  );
  const slots = useQuery<{ items: Slot[] }>(
    readHours && doctor?.calendarId
      ? `/v1/practitioners/${doctor.staffId}/slots?facilityId=${facility.facilityId}&from=${day}&to=${until}&includeUnavailable=true`
      : null,
  );
  const exactSlot = slots.data?.items.find((s) => s.facilityId === facility.facilityId && s.visitMode === mode);
  const readiness = useQuery<BookingReadiness>(
    readHours && doctor && exactSlot
      ? `/v1/booking/readiness?${query({ facilityId: facility.facilityId, staffId: doctor.staffId, slotStart: exactSlot.slotStart, visitMode: mode, healthcareServiceId: exactSlot.healthcareServiceId ?? "null" })}`
      : null,
    0,
    (value) => BookingReadinessSchema.parse(value),
  );
  const items = deriveSetup({
    facilityId: facility.facilityId,
    day,
    mode,
    clinic: evidence(clinic, readCatalog),
    doctors: rows(evidence(doctors, readCatalog)),
    doctor,
    directory: evidence(directory, readCatalog),
    prices: rows(evidence(prices, readCatalog)),
    sessions: rows(evidence(sessions, readHours)),
    slots: rows(evidence(slots, readHours)),
    readiness: exactSlot ? evidence(readiness, readHours) : undefined,
  });
  const checks = items.filter((i) => i.id !== "preview");
  const completed = checks.filter((i) => i.state === "complete").length;
  const showGuide = expanded ?? completed < checks.length;
  const active =
    activeItem || items.find((i) => i.state !== "complete")?.id || "preview";
  if (!admin) return null;
  return (
    <Card className="p-5 mb-6 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="font-semibold">Booking setup · {facility.name}</h2>
          <p className="text-sm text-muted-foreground">
            {completed} of {checks.length} configuration checks confirmed for{" "}
            {doctor?.name ?? "this clinic"}.{" "}
            {mode === "virtual" ? "Teleconsultations" : "In-person visits"} ·{" "}
            {day} through {until}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!showGuide)}
        >
          {showGuide ? "Hide guide" : "Review setup"}
        </Button>
      </div>
      {showGuide && (
        <>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Setup visit type"
          >
            {(["in_person", "virtual"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "default" : "outline"}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setActiveItem("");
                }}
              >
                {value === "virtual" ? "Teleconsultation" : "In person"}
              </Button>
            ))}
          </div>
          {practitioners.length > 1 && (
            <div className="max-w-sm">
              <Choice
                label="Setup doctor"
                value={doctor?.staffId ?? ""}
                onChange={setSelected}
                options={practitioners.map((p) => ({
                  value: p.staffId,
                  label: p.name,
                }))}
              />
            </div>
          )}
          <div className="divide-y">
            {items.map((i) => (
              <div
                key={i.id}
                className="py-3 flex justify-between gap-6 items-start"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => setActiveItem(i.id)}
                      aria-expanded={active === i.id}
                    >
                      {i.title}
                    </button>{" "}
                    <Status
                      value={
                        i.state === "complete"
                          ? "completed"
                          : i.state === "blocked" || i.state === "not_started"
                            ? "attention"
                            : "pending"
                      }
                      text={i.state === "complete"
                        ? "Confirmed"
                        : i.state === "loading"
                          ? "Checking…"
                          : i.state === "unknown"
                            ? "Evidence unavailable"
                            : i.state === "optional_deferred"
                              ? "Checked during booking"
                              : i.state === "blocked"
                                ? "Needs prerequisite"
                                : "Needs setup"}
                    />
                  </h3>
                  {active === i.id && (
                    <p className="text-sm text-muted-foreground">
                      {i.state === "unknown"
                        ? "The required read is unavailable or not permitted. This is not proof that configuration is missing."
                        : i.detail}
                    </p>
                  )}
                </div>
                {can(
                  i.destination.split("?")[0] === "appointments" ||
                    i.destination.split("?")[0] === "schedules"
                    ? "appointments.read"
                    : "catalog.read",
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => go(i.destination)}
                  >
                    {i.state === "complete"
                      ? "Review"
                      : can(i.permission)
                        ? "Continue"
                        : "View requirements"}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void doctors.refresh();
              void clinic.refresh();
              void directory.refresh();
              void prices.refresh();
              void sessions.refresh();
              void slots.refresh();
              void readiness.refresh();
            }}
          >
            Recheck saved setup
          </Button>
        </>
      )}
    </Card>
  );
}
