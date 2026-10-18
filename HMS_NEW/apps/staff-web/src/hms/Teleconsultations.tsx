import { DayNavigator } from "@/components/date-controls";
import { useEffect, useState } from "react";
import { Video } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { query } from "./client";
import { time, today } from "./model";
import { Choice, ErrorMessage, Field, Hint, LoadingState, Status } from "./ui";
export type JoinGrant = {
  domain: string;
  roomName: string;
  jwt: string;
  expiresAt: string;
  displayName: string;
};
type Tele = {
  sessionId: string;
  appointmentId: string;
  practitionerStaffId: string;
  patientName: string | null;
  doctorName: string;
  startsAt: string;
  status: string;
  consented: boolean;
  identityVerifiedAt: string | null;
  linkActive: boolean;
  encounterId: string | null;
  patientWaitingSince: string | null;
};
export function Teleconsultations() {
  const { facility, can, go } = useWorkspace();
  const [date, setDate] = useState(today(facility.timezone)),
    [selected, setSelected] = useState<Tele | null>(null);
  const result = useQuery<{ items: Tele[] }>(
    `/v1/teleconsults?${query({ facilityId: facility.facilityId, date })}`,
    5000,
  );
  return (
    <>
      <PageTitle
        title="Teleconsultations"
      />
      <div className="mb-5"><DayNavigator label="Teleconsultation date" value={date} onChange={setDate} timezone={facility.timezone} /></div>
      <LoadingState {...result}>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data?.items.map((t) => (
                <TableRow key={t.sessionId}>
                  <TableCell>{t.patientName ?? "Patient not linked"}</TableCell>
                  <TableCell>{t.doctorName}</TableCell>
                  <TableCell>{time(t.startsAt, facility.timezone)}</TableCell>
                  <TableCell>
                    <Status value={t.status} />
                  </TableCell>
                  <TableCell>{t.consented ? "Recorded" : "Required"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => setSelected(t)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.data?.items.length === 0 && (
            <WorkspaceEmpty
              title={`No video visits for ${date}`}
              action={
                can("appointments.book")
                  ? {
                      label: "Book video appointment",
                      onClick: () => go("appointments?book=1&mode=virtual"),
                    }
                  : { label: "View schedules", onClick: () => go("schedules") }
              }
            />
          )}
        </Card>
      </LoadingState>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent className="overflow-y-auto sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>
                {selected.patientName ?? "Teleconsultation"}
              </SheetTitle>
              <SheetDescription>{selected.doctorName}</SheetDescription>
            </SheetHeader>
            <TeleDetail sessionId={selected.sessionId} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
function TeleDetail({ sessionId }: { sessionId: string }) {
  const { me, can, go } = useWorkspace(),
    cmd = useCommand();
  const result = useQuery<Tele>(`/v1/teleconsults/${sessionId}`, 5000);
  const [link, setLink] = useState(""),
    [linkWarning, setLinkWarning] = useState(false),
    [grant, setGrant] = useState<JoinGrant | null>(null),
    [identityMethod, setIdentityMethod] = useState("known_patient"),
    [outcome, setOutcome] = useState("consulted");
  const t = result.data,
    assigned =
      can("teleconsult.conduct") && me.staffId === t?.practitionerStaffId;
  return (
    <div className="p-6 space-y-5">
      <ErrorMessage text={cmd.error} />
      <LoadingState {...result}>
        {t && (
          <>
            <Status value={t.status} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>Consent: {t.consented ? "Recorded" : "Not recorded"}</p>
              <p>
                Patient:{" "}
                {t.patientWaitingSince
                  ? "Entered waiting room"
                  : "Not waiting yet"}
              </p>
              <p>
                Identity: {t.identityVerifiedAt ? "Verified" : "Not verified"}
              </p>
              <p>Patient link: {t.linkActive ? "Active" : "Not active"}</p>
            </div>
            {can("teleconsult.manage") &&
              ["scheduled", "waiting", "in_progress"].includes(t.status) && (
                <div className="space-y-3">
                  {linkWarning ? (
                    <>
                      <Hint>
                        Issuing another link invalidates the previous one. Share
                        the new link with the intended patient only.
                      </Hint>
                      <Button
                        disabled={cmd.busy || cmd.unknown}
                        onClick={async () => {
                          const value = await cmd.run<{ url: string }>(
                            `/v1/appointments/${t.appointmentId}/teleconsult/link`,
                          );
                          if (value) {
                            setLink(value.url);
                            setLinkWarning(false);
                            result.refresh();
                          }
                        }}
                      >
                        Confirm new patient link
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setLinkWarning(true)}
                    >
                      {t.linkActive
                        ? "Reissue patient link"
                        : "Issue patient link"}
                    </Button>
                  )}
                  {link && (
                    <>
                      <Input
                        aria-label="Patient joining link"
                        readOnly
                        value={link}
                      />
                      <Button
                        variant="outline"
                        onClick={() => void navigator.clipboard.writeText(link)}
                      >
                        Copy patient link
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Shown only in this sheet. It cannot be retrieved after
                        closing.
                      </p>
                    </>
                  )}
                </div>
              )}
            {assigned && ["scheduled", "waiting"].includes(t.status) && (
              <Button
                disabled={cmd.busy || cmd.unknown || !t.consented}
                onClick={async () => {
                  if (await cmd.run(`/v1/teleconsults/${sessionId}/start`))
                    result.refresh();
                }}
              >
                <Video />
                Start video consultation
              </Button>
            )}
            {assigned && t.status === "in_progress" && (
              <div className="space-y-4">
                <Button
                  disabled={cmd.busy || cmd.unknown}
                  onClick={async () => {
                    const value = await cmd.run<JoinGrant>(
                      `/v1/teleconsults/${sessionId}/join`,
                    );
                    if (value) setGrant(value);
                  }}
                >
                  Join / reconnect video
                </Button>
                {grant && <VideoFrame key={grant.expiresAt} grant={grant} />}
                <Field
                  title="Identity confirmation method"
                  id="identity-method"
                >
                  <Choice
                    label="Identity method"
                    value={identityMethod}
                    onChange={setIdentityMethod}
                    options={[
                      { value: "known_patient", label: "Known patient" },
                      { value: "photo_id", label: "Photo ID checked" },
                      { value: "abha", label: "ABHA checked" },
                      {
                        value: "verified_by_staff",
                        label: "Verified by staff",
                      },
                    ]}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={cmd.busy || cmd.unknown}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/teleconsults/${sessionId}/identity`, {
                        method: identityMethod,
                      })
                    )
                      result.refresh();
                  }}
                >
                  Confirm patient identity
                </Button>
                <Field title="Call outcome" id="call-outcome">
                  <Choice
                    label="Call outcome"
                    value={outcome}
                    onChange={setOutcome}
                    options={[
                      { value: "consulted", label: "Consultation performed" },
                      {
                        value: "patient_did_not_join",
                        label: "Patient did not join",
                      },
                      {
                        value: "technical_failure",
                        label: "Technical failure",
                      },
                    ]}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={
                    cmd.busy ||
                    cmd.unknown ||
                    (outcome === "consulted" && !t.identityVerifiedAt)
                  }
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/teleconsults/${sessionId}/end`, {
                        outcome,
                      })
                    ) {
                      setGrant(null);
                      result.refresh();
                    }
                  }}
                >
                  End call with this outcome
                </Button>
              </div>
            )}
            {t.encounterId && can("encounters.read") && (
              <Button variant="outline" onClick={() => go("consultations")}>
                Open clinical worklist
              </Button>
            )}
            <Hint>
              Ending a video call does not finish the clinical encounter.
              Complete notes and disposition in the consultation workspace.
            </Hint>
          </>
        )}
      </LoadingState>
      {cmd.unknown && (
        <Button
          variant="outline"
          onClick={async () => {
            if (await result.refresh()) cmd.reconciled();
          }}
        >
          Refresh session before continuing
        </Button>
      )}
    </div>
  );
}
export function VideoFrame({ grant }: { grant: JoinGrant }) {
  const [expired, setExpired] = useState(
    () => Date.parse(grant.expiresAt) <= Date.now(),
  );
  useEffect(() => {
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(grant.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [grant.expiresAt]);
  if (expired)
    return (
      <Hint>Video access expired. Request a fresh join to reconnect.</Hint>
    );
  if (
    !/^[a-z0-9.-]+(?::\d+)?$/i.test(grant.domain) ||
    grant.domain.endsWith(".localhost")
  )
    return (
      <Hint>
        The video provider has not been configured for real calls in this
        preview.
      </Hint>
    );
  const url = `https://${grant.domain}/${encodeURIComponent(grant.roomName)}?jwt=${encodeURIComponent(grant.jwt)}`;
  return (
    <iframe
      title="Video consultation"
      className="w-full aspect-video rounded-lg border"
      src={url}
      allow="camera; microphone; fullscreen; display-capture"
      referrerPolicy="no-referrer"
    />
  );
}
