// My alerts (Arc Inbox triage): what needs the signed-in person now and what is coming up (docs/prd/staff-alerts.md).
// Folders keep the component's Inbox / Snoozed / Archive model, labelled Open / Snoozed / Done.
import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { PageTitle } from "@/components/workspace";
import { Button } from "@/components/arc/button/button";
import { InboxTriage, type TriageCopy, type TriageFolder, type TriageMessage } from "@/components/arc/inbox-triage/inbox-triage";
import { useWorkspace } from "./hooks";
import { useAlerts } from "./use-alerts";
import { tomorrowStart, whenLabel, type MarkedAlert } from "./alerts";
import { ErrorMessage, Hint } from "./ui";

const COPY: TriageCopy = {
  folders: { inbox: "Open", snoozed: "Snoozed", archive: "Done" },
  moved: { inbox: "Moved to Open", snoozed: "Snoozed until tomorrow", archive: "Marked done" },
  actions: { snooze: "Snooze", archive: "Done", restore: "Move to Open" },
  empty: {
    unread: { title: "Nothing unread", body: "You are caught up.", action: "Show all" },
    inbox: { title: "All clear", body: "Nothing needs you right now. Done alerts stay listed.", action: "View done" },
    snoozed: { title: "Nothing snoozed", body: "Snoozed alerts come back tomorrow.", action: "Back to open" },
    archive: { title: "Nothing done yet", body: "Alerts you mark done land here.", action: "Back to open" },
  },
  narrowHint: { inbox: "Open an alert to snooze it or mark it done", other: "Open an alert to move it" },
};
const FOLDER: Record<MarkedAlert["folder"], TriageFolder> = { open: "inbox", snoozed: "snoozed", done: "archive" };
const PAGE: Record<string, string> = {
  queue: "Queue", appointments: "Appointments", waitlist: "Waitlist", teleconsultations: "Teleconsultations",
  consultations: "Consultations", schedules: "Schedules", settings: "Workspace settings", doctors: "Doctors", catalogue: "Hospital catalogue",
};

export function AlertsPage() {
  const { facility, go } = useWorkspace();
  const { alerts, unavailable, error, now, mark } = useAlerts();
  const byKey = useMemo(() => new Map(alerts.map((a) => [a.key, a])), [alerts]);
  const messages = useMemo<TriageMessage[]>(
    () =>
      alerts.map((a) => ({
        id: a.key,
        name: a.who,
        subject: a.title,
        preview: `${a.bucket === "now" ? "Now" : "Coming up"} · ${a.detail}`,
        body: `${a.source}. ${/[.!?]$/.test(a.detail) ? a.detail : `${a.detail}.`}`,
        time: whenLabel(a, now, facility.timezone),
        folder: FOLDER[a.folder],
        unread: a.folder === "open" && !a.read,
      })),
    [alerts, now, facility.timezone],
  );
  const target = (m: TriageMessage) => byKey.get(m.id);
  return (
    <>
      <PageTitle title="My alerts" />
      <div className="mb-5 space-y-3">
        <ErrorMessage text={error} />
        {unavailable.length > 0 && <Hint>{unavailable.join(", ")} could not be checked, so this list may be incomplete.</Hint>}
      </div>
      <div className="arc-demo-scope arc-section-frame">
        <InboxTriage
          title={`Alerts · ${facility.name}`}
          messages={messages}
          copy={COPY}
          onRead={(m) => { const a = target(m); if (a) void mark([a], { read: true }); }}
          onMove={(m, to) => {
            const a = target(m);
            if (!a) return;
            void mark([a], to === "archive" ? { dismissed: true } : to === "snoozed" ? { dismissed: false, snoozedUntil: tomorrowStart(Date.now(), facility.timezone) } : { dismissed: false, snoozedUntil: null });
          }}
          detailAction={(m) => {
            const a = target(m);
            const page = a?.destination.split("?")[0] ?? "";
            return a ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => go(a.destination)}>
                <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
                Open {PAGE[page] ?? "page"}
              </Button>
            ) : null;
          }}
        />
      </div>
    </>
  );
}
