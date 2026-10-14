import { ArrowRight, Stethoscope } from "lucide-react";
import { PageTitle } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { addDays } from "./forms";
import type { ClinicDirectory, PriceBookItem, Session } from "./types";
import { StepDot, type Clinic } from "./whatsapp-ui";

/** Doctors, fees and hours: what patient-facing channels need before they can be switched on. */
export function useClinicBasics() {
  const { facility, practitioners, can } = useWorkspace();
  const day = today(facility.timezone);
  const readCatalog = can("catalog.read"),
    readHours = can("appointments.read");
  const doctors = practitioners.filter((p) => p.facilityId === facility.facilityId);
  const calendared = doctors.find((d) => d.calendarId);
  const prices = useQuery<{ items: PriceBookItem[] }>(
    readCatalog ? `/v1/facilities/${facility.facilityId}/price-book?on=${day}` : null,
  );
  const directory = useQuery<ClinicDirectory>(readCatalog ? `/v1/facilities/${facility.facilityId}/directory` : null);
  const sessions = useQuery<{ items: Session[] }>(
    readHours && calendared
      ? `/v1/practitioners/${calendared.staffId}/sessions?from=${day}&to=${addDays(day, 30)}`
      : null,
  );
  if (prices.loading || directory.loading || sessions.loading) return { loading: true as const };
  // Unreadable evidence never blocks; going live re-checks.
  const missing = [
    !doctors.length && "doctors",
    readCatalog && prices.data && !prices.data.items.length && "fees",
    readHours && (!calendared || (sessions.data && !sessions.data.items.length)) && "hours",
  ].filter(Boolean) as string[];
  const departments = (directory.data?.departments ?? [])
    .filter((d) => d.status !== "inactive")
    .filter((d) => doctors.some((p) => p.department === d.name || p.department === d.departmentId))
    .map((d) => ({ id: d.departmentId, name: d.name }));
  const clinic: Clinic = {
    name: facility.name,
    doctors,
    departments,
    fee: (staffId) => {
      const item = prices.data?.items.find((p) => p.staffId === staffId) ?? prices.data?.items.find((p) => !p.staffId);
      return item ? item.feeMinor / 100 : null;
    },
  };
  return { loading: false as const, missing, clinic, directory: directory.data, prices: prices.data?.items ?? [] };
}

export function RegisterFirst({ title, text, missing }: { title: string; text: string; missing: string[] }) {
  const { go } = useWorkspace();
  const items = [
    ["doctors", "Add your doctors", "Name, speciality and who patients can book.", "doctors"],
    ["fees", "Set consultation fees", "Patients see the fee before they confirm.", "catalogue"],
    ["hours", "Publish consultation hours", "Patients are only offered times you've opened.", "schedules"],
  ] as const;
  return (
    <>
      <PageTitle title={title} />
      <Card className="mx-auto max-w-2xl p-8 text-center shadow-none">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-muted">
          <Stethoscope className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Register your doctors first</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
        <ol className="mt-6 divide-y rounded-lg border text-left">
          {items.map(([key, name, hint, page], i) => {
            const done = !missing.includes(key);
            return (
              <li key={key} className="flex items-center gap-4 p-4">
                <StepDot done={done} n={i + 1} active={!done} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                {done ? (
                  <span className="text-xs text-muted-foreground">Done</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => go(page)}>
                    Open <ArrowRight />
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
