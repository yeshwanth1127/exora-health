import { QueueBoard } from "./QueueBoard";
import type { ClinicQueueToken } from "./queue-board";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/arc/tabs/tabs";
import { PatientHover } from "./PatientHover";
import { patientDisplayName } from "./patient-presentation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListOrdered, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayNavigator } from "@/components/date-controls";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query, request } from "./client";
import { today, label } from "./model";
import { Choice, ErrorMessage, Hint, LoadingState, Status } from "./ui";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { WalkIn } from "./WalkIn";
import { requestLeave } from "./leave";
import type { QueueToken, PatientDetail, Practitioner } from "./types";

export function Queue() {
  const { facility, practitioners, can, go } = useWorkspace(),
    cmd = useCommand();
  const [staffId, setStaffId] = useState(""),
    [date, setDate] = useState(today(facility.timezone)),
    [notice, setNotice] = useState(""),
    [walkIn, setWalkIn] = useState(false),
    [view, setView] = useState("board");
  const doctors = useMemo(
    () => [
      ...new Map(
        practitioners
          .filter((p) => p.facilityId === facility.facilityId)
          .map((p) => [p.staffId, p]),
      ).values(),
    ],
    [practitioners, facility.facilityId],
  );
  const selected = doctors.some((p) => p.staffId === staffId) ? staffId : "";
  const key = { staffId: selected, facilityId: facility.facilityId, date };
  const result = useClinicQueue(doctors, selected, date);
  return (
    <>
      <PageTitle
        title="Queue"
        action={
          <div className="flex gap-2">
            {can("appointments.check_in") && can("patients.read") && (
              <Button
                variant="outline"
                disabled={!selected}
                onClick={() => setWalkIn(true)}
              >
                <UserPlus />
                Walk-in arrival
              </Button>
            )}
            {can("queue.manage") && (
              <Button
                disabled={!selected || cmd.busy || cmd.unknown}
                onClick={async () => {
                  const next = await cmd.run<QueueToken>(
                    "/v1/queue/call-next",
                    key,
                  );
                  if (next) setNotice(`Called token ${next.tokenNo}.`);
                  result.refresh();
                }}
              >
                <ListOrdered />
                Call next patient
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="w-60">
          <Choice
            label="Queue doctor"
            value={selected}
            onChange={value => requestLeave(() => setStaffId(value))}
            options={[
              { value: "", label: "All doctors" },
              ...doctors.map((p) => ({
                value: p.staffId,
                label: p.name,
              })),
            ]}
          />
        </div>
        <DayNavigator
          label="Queue day"
          timezone={facility.timezone}
          value={date}
          onChange={value => requestLeave(() => setDate(value))}
          actions={<Button
            variant="outline"
            onClick={async () => {
              if (await result.refresh()) cmd.reconciled();
            }}
          ><RefreshCw />Refresh</Button>}
        />
      </div>
      {walkIn && selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) requestLeave(() => setWalkIn(false));
          }}
        >
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Walk-in arrival</SheetTitle>
              <SheetDescription>
                {practitioners.find((p) => p.staffId === selected)?.name} ·{" "}
                {facility.name}
              </SheetDescription>
            </SheetHeader>
            <WalkIn
              staffId={selected}
              onCreated={(value) => {
                setNotice(`Walk-in checked in. Token ${value.tokenNo}.`);
                setDate(value.sessionOn);
                setWalkIn(false);
                result.refresh();
              }}
            />
          </SheetContent>
        </Sheet>
      )}
      <div className="space-y-4">
        <ErrorMessage text={cmd.error} />
        {notice && <Hint>{notice}</Hint>}
        <Tabs value={view} onValueChange={setView}>
          <div className="arc-demo-scope mb-4"><TabsList aria-label="Queue presentation"><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="table">Table</TabsTrigger></TabsList></div>
          <TabsContent value="board"><LoadingState {...result}>
            <QueueBoard tokens={result.data?.items ?? []} command={cmd} unavailable={result.loading || !!result.error}
              date={date} patient={token => <QueuePatient patientId={token.patientId} appointmentId={token.appointmentId} />}
              onChanged={message => { setNotice(message); void result.refresh(); }} />
          </LoadingState></TabsContent>
          <TabsContent value="table"><LoadingState {...result}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data?.items.map((t) => (
                  <TableRow key={t.tokenId}>
                    <TableCell>{t.doctorName}</TableCell>
                    <TableCell className="font-semibold">{t.tokenNo}</TableCell>
                    <TableCell>{label(t.priority)}</TableCell>
                    <TableCell>
                      <Status value={t.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <QueuePatient patientId={t.patientId} appointmentId={t.appointmentId} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {can("encounters.read") && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              go(
                                `consultations?patient=${t.patientId}&date=${date}`,
                              )
                            }
                          >
                            Consultations
                          </Button>
                        )}
                        {can("queue.manage") && t.status === "called" && (
                          <Button
                            variant="outline"
                            disabled={cmd.busy || cmd.unknown}
                            onClick={async () => {
                              if (
                                await cmd.run(
                                  `/v1/queue-tokens/${t.tokenId}/start`,
                                )
                              ) {
                                result.refresh();
                                setNotice(
                                  `Token ${t.tokenNo} is with the doctor.`,
                                );
                              }
                            }}
                          >
                            Start serving
                          </Button>
                        )}
                        {can("queue.manage") &&
                          ["waiting", "called"].includes(t.status) && (
                            <Button
                              variant="outline"
                              disabled={cmd.busy || cmd.unknown}
                              onClick={async () => {
                                if (
                                  await cmd.run(
                                    `/v1/queue-tokens/${t.tokenId}/skip`,
                                  )
                                ) {
                                  result.refresh();
                                  setNotice(`Skipped token ${t.tokenNo}.`);
                                }
                              }}
                            >
                              Skip
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.data?.items.length === 0 && (
              <WorkspaceEmpty
                title={
                  doctors.length
                    ? "No queue arrivals for this day"
                    : "No doctors in this clinic"
                }
                action={
                  doctors.length
                    ? selected &&
                      can("appointments.check_in") &&
                      can("patients.read")
                      ? {
                          label: "Record a walk-in",
                          onClick: () => setWalkIn(true),
                        }
                      : date !== today(facility.timezone)
                        ? {
                            label: "View today",
                            onClick: () => setDate(today(facility.timezone)),
                          }
                        : undefined
                  : can("catalog.manage") && can("catalog.read")
                      ? { label: "Open doctors", onClick: () => go("doctors") }
                      : undefined
                }
              />
            )}
          </Card>
        </LoadingState></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function QueuePatient({ patientId, appointmentId }: { patientId: string; appointmentId?: string | null }) {
  const { can } = useWorkspace();
  const result = useQuery<PatientDetail>(
    can("patients.read") ? `/v1/patients/${patientId}` : null,
  );
  return result.data ? (
    <div>
      <div className="font-sans text-sm">
        <PatientHover patientId={patientId} appointmentId={appointmentId} detail={result.data} name={patientDisplayName(patientId,
          [result.data.givenName, result.data.familyName].filter(Boolean).join(" "))} />
      </div>
      <p className="text-xs text-muted-foreground">{result.data.mrn}</p>
    </div>
  ) : (
    <span>{patientId.slice(0, 8)}</span>
  );
}

/** The read route is per doctor; combine all scoped doctor queues without changing command routing. */
function useClinicQueue(
  doctors: Practitioner[],
  staffId: string,
  date: string,
) {
  const { me, facility } = useWorkspace();
  const ids = doctors
    .filter((p) => !staffId || p.staffId === staffId)
    .map((p) => p.staffId)
    .sort();
  const key = JSON.stringify([me.tenantId, facility.facilityId, date, ids]);
  const reload = useRef<(() => Promise<boolean>) | null>(null);
  const [state, setState] = useState<{
    key: string;
    data: { items: ClinicQueueToken[] } | null;
    loading: boolean;
    error: string;
  }>({ key: "", data: null, loading: true, error: "" });
  const names = useMemo(
    () => new Map(doctors.map((p) => [p.staffId, p.name])),
    [doctors],
  );
  useEffect(() => {
    let alive = true,
      sequence = 0,
      controller: AbortController | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const [, at, day, selectedIds] = JSON.parse(key) as [
      string,
      string,
      string,
      string[],
    ];
    async function load() {
      const current = ++sequence;
      controller?.abort();
      clearTimeout(timer);
      controller = new AbortController();
      setState((old) => ({
        key,
        data: old.key === key ? old.data : null,
        loading: old.key !== key || !old.data,
        error: "",
      }));
      try {
        const queues = await Promise.all(
          selectedIds.map(async (id) => {
            const r = await request<{ items: QueueToken[] }>(
              `/v1/queue?${query({ staffId: id, facilityId: at, date: day })}`,
              { signal: controller!.signal },
            );
            return r.items.map((t) => ({
              ...t,
              doctorName: names.get(id) ?? "Doctor",
              doctorStaffId: id,
            }));
          }),
        );
        if (alive && current === sequence) {
          setState({
            key,
            data: { items: queues.flat() },
            loading: false,
            error: "",
          });
          return true;
        }
      } catch (e) {
        if (
          alive &&
          current === sequence &&
          !(e instanceof Error && e.name === "AbortError")
        )
          setState({
            key,
            data: null,
            loading: false,
            error:
              e instanceof Error
                ? e.message
                : "Could not load the clinic queue.",
          });
      } finally {
        if (
          alive &&
          current === sequence &&
          document.visibilityState === "visible"
        )
          timer = setTimeout(() => void load(), 5000);
      }
      return false;
    }
    const visible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") void load();
    };
    reload.current = load;
    document.addEventListener("visibilitychange", visible);
    void load();
    return () => {
      alive = false;
      reload.current = null;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, names]);
  return {
    data: state.key === key ? state.data : null,
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : "",
    refresh: useCallback(async () => (await reload.current?.()) ?? false, []),
  };
}
