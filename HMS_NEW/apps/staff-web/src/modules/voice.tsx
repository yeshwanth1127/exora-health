import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  RefreshCw,
  FileText,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { api, recordingBlob, dateTime } from "@/lib/api";
import {
  Field,
  Choice,
  PageTitle,
  Resource,
  Notice,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Call = {
  id: string;
  runtime_session_id: string;
  status: string;
  channel: string;
  agent_version: number | null;
  started_at: string;
  ended_at: string | null;
  turn_count: number;
  tool_call_count: number;
  last_intent: string | null;
  appointment: { id: string; confirmation_code: string; status: string } | null;
  recording_state: string;
  transcript_state: string;
  consented_at: string | null;
  recording_available_until: string | null;
};
type History = {
  calls: Call[];
  total: number;
  summary: {
    calls: number;
    bookings: number;
    errors: number;
    completed: number;
    tool_calls: number;
    period_days: number;
  };
  can_review_recordings: boolean;
  configuration: {
    calls_ready: boolean;
    recordings_ready: boolean;
    transcripts_ready: boolean;
    access_days: number;
    agent_version: number | null;
  };
};
type Access = {
  id: string;
  session_id: string;
  actor: string;
  outcome: string;
  created_at: string;
};
const recordingLabels: Record<string, string> = {
  eligible: "Review recording and transcript",
  pending: "Awaiting call details",
  no_consent: "No recording consent",
  expired: "Access expired",
  not_configured: "Playback needs setup",
};
type Transcript = {
  source: "demo" | "sarvam";
  turns: {
    role: "user" | "agent";
    english_text: string | null;
    original_text: string | null;
  }[];
};
function TranscriptReview({ call }: { call: Call }) {
  const [data, setData] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [version, setVersion] = useState(0),
    [language, setLanguage] = useState("original"),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (call.transcript_state !== "eligible") return;
    let alive = true;
    api<Transcript>(
      `/api/v1/staff/voice/sessions/${encodeURIComponent(call.id)}/transcript`,
      { method: "POST" },
    )
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not load the transcript.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [call.id, call.transcript_state, version]);
  const text = (turn: Transcript["turns"][number]) =>
    language === "english"
      ? turn.english_text || turn.original_text || ""
      : turn.original_text || turn.english_text || "";
  const turns = (data?.turns ?? [])
    .map((turn, index) => ({ ...turn, index, text: text(turn) }))
    .filter((turn) =>
      turn.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
  return (
    <section className="min-w-0 space-y-4" aria-label="Call transcript">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="size-4" />
          Transcript
        </h3>
        {data && <Badge variant="outline">{data.turns.length} turns</Badge>}
      </div>
      {call.transcript_state !== "eligible" ? (
        <Notice
          title="Transcript unavailable"
          text={
            transcriptLabels[call.transcript_state] ??
            "Call details are pending."
          }
        />
      ) : loading ? (
        <div
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Loading transcript…
        </div>
      ) : error ? (
        <Notice
          title="Transcript could not be opened"
          text={error}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true);
                setError("");
                setVersion((v) => v + 1);
              }}
            >
              Try again
            </Button>
          }
        />
      ) : (
        data && (
          <>
            {data.source === "demo" && (
              <p className="text-xs text-muted-foreground">
                Sample conversation for this demo. The demo recording is a test
                tone, not spoken audio.
              </p>
            )}
            <div className="grid sm:grid-cols-[1fr_180px] gap-3">
              <Field label="Find in transcript" id="transcript-search">
                <Input
                  id="transcript-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search this conversation…"
                />
              </Field>
              <Choice
                label="Transcript language"
                value={language}
                onChange={setLanguage}
                options={[
                  ["original", "As spoken"],
                  ["english", "English"],
                ]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {language === "english"
                ? "English text is shown where provided. Original-language text is used when an English version is unavailable."
                : "Original-language text is shown where provided. English is used when that text is unavailable."}{" "}
              Turn numbers show conversation order.
            </p>
            <div
              className="max-h-[50dvh] overflow-y-auto rounded-md border px-4"
              role="log"
              aria-label="Transcript turns"
            >
              {turns.map((turn) => (
                <article
                  key={turn.index}
                  className="py-4 border-b last:border-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold flex items-center gap-2">
                      {turn.role === "agent" ? (
                        <Headphones className="size-3.5 text-muted-foreground" />
                      ) : (
                        <UserRound className="size-3.5 text-muted-foreground" />
                      )}
                      {turn.role === "agent" ? "Clinic assistant" : "Caller"}
                    </p>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      Turn {turn.index + 1}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {turn.text}
                  </p>
                  {language === "english" && !turn.english_text && (
                    <p className="text-xs text-muted-foreground mt-1">
                      English text unavailable; showing original.
                    </p>
                  )}
                </article>
              ))}
              {!turns.length && (
                <p className="py-8 text-sm text-muted-foreground">
                  No turns match this search.
                </p>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
const transcriptLabels: Record<string, string> = {
  no_consent: "There is no recorded consent to review this call.",
  expired: "Transcript access for this call has expired.",
  pending: "The call has not finished or its transcript is still processing.",
  not_configured:
    "Transcript review has not been connected yet. Contact your clinic administrator.",
};
function RecordingReview({ call }: { call: Call }) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const objectUrl = useRef("");
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  async function load() {
    setBusy(true);
    setError("");
    try {
      const blob = await recordingBlob(
        `/api/v1/staff/voice/sessions/${encodeURIComponent(call.id)}/recording`,
      );
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setUrl(objectUrl.current);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the recording.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-6">
      <section className="space-y-5 min-w-0" aria-label="Recording details">
        <h3 className="font-semibold flex items-center gap-2">
          <Headphones className="size-4" />
          Recording
        </h3>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Call started</dt>
            <dd className="mt-1">{dateTime(call.started_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Outcome</dt>
            <dd className="mt-1 capitalize">
              {call.status.replaceAll("_", " ")}
            </dd>
          </div>
          {call.appointment && (
            <div>
              <dt className="text-xs text-muted-foreground">
                Booking reference
              </dt>
              <dd className="mt-1 font-mono text-xs break-all">
                {call.appointment.confirmation_code}
              </dd>
            </div>
          )}
        </dl>
        {error && <Notice title="Recording could not be opened" text={error} />}
        {url ? (
          <audio
            controls
            preload="metadata"
            src={url}
            className="w-full"
            aria-label="Call recording"
          />
        ) : (
          <Button
            variant="outline"
            disabled={busy || call.recording_state !== "eligible"}
            onClick={load}
          >
            <Headphones />
            {busy
              ? "Retrieving recording…"
              : call.recording_state === "eligible"
                ? "Load recording"
                : recordingLabels[call.recording_state]}
          </Button>
        )}
        <details className="border-t pt-4 text-xs">
          <summary className="cursor-pointer font-medium">
            Consent & call details
          </summary>
          <dl className="space-y-3 mt-4 text-muted-foreground">
            <div>
              <dt>Recording consent</dt>
              <dd className="mt-1 text-foreground">
                {call.consented_at
                  ? dateTime(call.consented_at)
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Access ends</dt>
              <dd className="mt-1 text-foreground">
                {call.recording_available_until
                  ? dateTime(call.recording_available_until)
                  : "Pending"}
              </dd>
            </div>
            <div>
              <dt>Call ended</dt>
              <dd className="mt-1 text-foreground">
                {call.ended_at ? dateTime(call.ended_at) : "In progress"}
              </dd>
            </div>
            <div>
              <dt>Session reference</dt>
              <dd className="mt-1 text-foreground break-all">
                {call.runtime_session_id}
              </dd>
            </div>
          </dl>
        </details>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Recording and transcript access is logged against your administrator
          account. Recently ended calls may still be processing.
        </p>
      </section>
      <TranscriptReview key={call.id} call={call} />
    </div>
  );
}
function RecordingAudit() {
  const r = useResource<Access[]>("/api/v1/staff/voice/recording-access");
  return (
    <Resource {...r}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Administrator</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.data?.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{dateTime(a.created_at)}</TableCell>
              <TableCell>{a.actor}</TableCell>
              <TableCell className="font-mono text-xs">
                {a.session_id.slice(0, 8)}
              </TableCell>
              <TableCell>{a.outcome.replaceAll("_", " ")}</TableCell>
            </TableRow>
          ))}
          {!r.data?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground py-8">
                No recordings or transcripts have been requested.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Resource>
  );
}
export function VoiceModule({ demo = false }: { demo?: boolean }) {
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<Call | null>(null),
    [tab, setTab] = useState("calls");
  const r = useResource<History>(`/api/v1/staff/voice?offset=${offset}`);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Voice"
        description="Review assistant calls and the bookings they created."
        action={
          <Button variant="outline" onClick={r.refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <Resource {...r}>
        {r.data && (
          <>
            {!demo && !r.data.configuration.calls_ready && (
              <Notice
                title="Calling needs setup"
                text="Configure the clinic’s Sarvam agent and approved version before patients can start calls."
              />
            )}
            {r.data.can_review_recordings &&
              !r.data.configuration.recordings_ready && (
                <Notice
                  title="Recording playback needs setup"
                  text="Verify the provider’s recording response and download host. Call history remains available."
                />
              )}
            <Card>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 py-6">
                {[
                  ["Calls", r.data.summary.calls],
                  ["Bookings created", r.data.summary.bookings],
                  ["Call errors", r.data.summary.errors],
                  ["Completed calls", r.data.summary.completed],
                  ["Tool activity", r.data.summary.tool_calls],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">
                      {label} · 30 days
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList>
                <TabsTrigger value="calls">Call history</TabsTrigger>
                {r.data.can_review_recordings && (
                  <TabsTrigger value="access">Review access</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="calls">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent calls</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Started</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Booking</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Review</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.data.calls.map((call) => (
                          <TableRow key={call.id}>
                            <TableCell>
                              <p className="whitespace-nowrap">
                                {dateTime(call.started_at)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {call.channel === "phone" ? "Phone" : "Website"}{" "}
                                · {call.turn_count} turns ·{" "}
                                {call.tool_call_count} tools
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  call.status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="capitalize"
                              >
                                {call.status === "issued"
                                  ? "Connecting"
                                  : call.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {call.last_intent?.replaceAll("_", " ") ??
                                  "Conversation started"}
                              </p>
                            </TableCell>
                            <TableCell>
                              {call.appointment ? (
                                <span className="font-mono text-xs">
                                  {call.appointment.confirmation_code}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  No booking
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {call.agent_version
                                ? `v${call.agent_version}`
                                : "Legacy"}
                            </TableCell>
                            <TableCell>
                              {r.data!.can_review_recordings ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    call.recording_state !== "eligible" &&
                                    call.transcript_state !== "eligible"
                                  }
                                  onClick={() => setSelected(call)}
                                >
                                  <Headphones className="size-4" />
                                  {call.recording_state === "eligible" ||
                                  call.transcript_state === "eligible"
                                    ? "Review recording and transcript"
                                    : recordingLabels[call.recording_state]}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Admin access only
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!r.data.calls.length && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="py-12 text-center text-muted-foreground"
                            >
                              Calls will appear here when patients use the voice
                              assistant.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between gap-3 pt-5">
                      <p className="text-xs text-muted-foreground">
                        {r.data.total
                          ? `${offset + 1}–${offset + r.data.calls.length} of ${r.data.total} calls`
                          : "No calls yet"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!offset}
                          onClick={() => setOffset((o) => o - 25)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={offset + 25 >= r.data.total}
                          onClick={() => setOffset((o) => o + 25)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              {tab === "access" && r.data.can_review_recordings && (
                <TabsContent value="access">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Recent recording and transcript requests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RecordingAudit />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
            <Dialog
              open={!!selected}
              onOpenChange={(open) => {
                if (!open) setSelected(null);
              }}
            >
              <DialogContent
                style={{ width: "min(95vw, 1040px)", maxWidth: "95vw" }}
                className="max-h-[90dvh] overflow-y-auto"
              >
                <DialogHeader>
                  <DialogTitle>Review recording and transcript</DialogTitle>
                  <DialogDescription>
                    {selected?.appointment
                      ? `Booking ${selected.appointment.confirmation_code}`
                      : "Listen to the call and review what was said"}
                  </DialogDescription>
                </DialogHeader>
                {selected && (
                  <RecordingReview key={selected.id} call={selected} />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </Resource>
    </div>
  );
}
