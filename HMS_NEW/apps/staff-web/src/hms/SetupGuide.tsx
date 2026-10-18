import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReleaseReadiness } from "@/components/arc/release-readiness/release-readiness";
import { useWorkspace } from "./hooks";
import { useSetupItems } from "./use-setup";
import { Choice } from "./ui";
import { readinessTasks } from "./setup-readiness";
/** Configuration evidence only. Never creates holds, bookings, staff or provider connections. */
export function SetupGuide() {
  const { facility, can, go } = useWorkspace();
  const [expanded, setExpanded] = useState<boolean | null>(null),
    [mode, setMode] = useState<"in_person" | "virtual">("in_person"),
    [selected, setSelected] = useState("");
  const { admin, day, until, practitioners, doctor, items, recheck } = useSetupItems(mode, selected);
  const checks = items.filter((i) => i.id !== "preview");
  const completed = checks.filter((i) => i.state === "complete").length;
  const showGuide = expanded ?? completed < checks.length;
  if (!admin) return null;
  return (
    <div className="arc-demo-scope arc-section-frame mb-6">
      <ReleaseReadiness
        title={`Booking setup · ${facility.name}`}
        subtitle={`Configuration checks for ${doctor?.name ?? "this clinic"}. ${mode === "virtual" ? "Teleconsultations" : "In-person visits"} · ${day} through ${until}.`}
        tasksLabel="Booking setup checks"
        readyLabel="Ready for bookings"
        tasks={readinessTasks(items).map((t, n) => {
          const i = items[n]!;
          return {
            ...t,
            action: can(
              i.destination.split("?")[0] === "appointments" ||
                i.destination.split("?")[0] === "schedules"
                ? "appointments.read"
                : "catalog.read",
            ) && (
              <Button variant="outline" size="sm" onClick={() => go(i.destination)}>
                {i.state === "complete"
                  ? "Review"
                  : can(i.permission)
                    ? "Continue"
                    : "View requirements"}
              </Button>
            ),
          };
        })}
        actionLabel="Recheck saved setup"
        onAction={recheck}
        errorMessage="Some saved setup could not be rechecked. Try again."
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setExpanded(!showGuide)}>
            {showGuide ? "Hide guide" : "Review setup"}
          </Button>
        }
        collapsed={!showGuide}
        toolbar={
          <>
            <div className="flex gap-2" role="group" aria-label="Setup visit type">
              {(["in_person", "virtual"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={mode === value ? "default" : "outline"}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {value === "virtual" ? "Teleconsultation" : "In person"}
                </Button>
              ))}
            </div>
            {practitioners.length > 1 && (
              <div className="max-w-sm min-w-60">
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
          </>
        }
      />
    </div>
  );
}
