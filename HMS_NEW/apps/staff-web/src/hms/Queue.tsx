import { useState } from "react";
import { ListOrdered, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { query } from "./client";
import { today, label } from "./model";
import { Choice, Empty, ErrorMessage, Hint, LoadingState, Status } from "./ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { WalkIn } from "./WalkIn";
import { confirmLeave } from "./leave";
import type { QueueToken, PatientDetail } from "./types";

export function Queue() {
  const { facility, practitioners, can, go } = useWorkspace(),
    cmd = useCommand();
  const [staffId, setStaffId] = useState(""),
    [date, setDate] = useState(today(facility.timezone)),
    [notice, setNotice] = useState(""),
    [walkIn, setWalkIn] = useState(false);
  const selected = staffId || practitioners[0]?.staffId || "";
  const key = { staffId: selected, facilityId: facility.facilityId, date };
  const result = useQuery<{ items: QueueToken[] }>(
    selected ? `/v1/queue?${query(key)}` : null,
    5000,
  );
  return (
    <>
      <PageTitle
        title="Queue"
        description="Call the next patient and hand them over for consultation."
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
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="w-60">
          <Choice
            label="Queue doctor"
            value={selected}
            onChange={setStaffId}
            options={practitioners.map((p) => ({
              value: p.staffId,
              label: p.name,
            }))}
          />
        </div>
        <Input
          type="date"
          aria-label="Queue date"
          className="w-44"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={async () => {
            if (await result.refresh()) cmd.reconciled();
          }}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {walkIn && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && confirmLeave()) setWalkIn(false);
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
        <LoadingState {...result}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell className="font-semibold">{t.tokenNo}</TableCell>
                    <TableCell>{label(t.priority)}</TableCell>
                    <TableCell>
                      <Status value={t.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <QueuePatient patientId={t.patientId} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {can("encounters.read") && (
                          <Button
                            variant="ghost"
                            onClick={() => go("consultations")}
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
              <Empty>No queue tokens for this doctor and day.</Empty>
            )}
          </Card>
        </LoadingState>
        <p className="text-xs text-muted-foreground">
          Consultations are completed in the clinical workspace. The direct
          queue-complete shortcut is not enabled.
        </p>
      </div>
    </>
  );
}

function QueuePatient({ patientId }: { patientId: string }) {
  const { can } = useWorkspace();
  const result = useQuery<PatientDetail>(
    can("patients.read") ? `/v1/patients/${patientId}` : null,
  );
  return result.data ? (
    <div>
      <p className="font-sans text-sm">
        {[result.data.givenName, result.data.familyName]
          .filter(Boolean)
          .join(" ")}
      </p>
      <p className="text-xs text-muted-foreground">{result.data.mrn}</p>
    </div>
  ) : (
    <span>{patientId.slice(0, 8)}</span>
  );
}
