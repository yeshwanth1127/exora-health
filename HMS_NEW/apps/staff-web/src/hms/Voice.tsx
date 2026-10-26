import { useWorkspaceTab } from "./use-workspace-tab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/arc/tabs/tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChannelOnboarding } from "./ChannelOnboarding";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  Database,
  Globe2,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { VoiceModule } from "@/modules/voice";
import { OriginalResourceContext } from "@/components/resource-source";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { voiceSource } from "./voice-source";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";
import { requestBytes } from "./client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceChoice } from "@/components/WorkspaceChoice";

type VoiceRuntime = {
  enabled: boolean;
  integration_ready: boolean;
  agent_ready: boolean;
  state: "active" | "awaiting_sarvam_agent" | "not_requested";
  app_id?: string;
  version?: number;
  agent_name?: string;
  phone_number?: string | null;
  recording_notice?: string;
  session_seconds?: number;
};

type BookingBootstrap = {
  facilities: { facilityId: string; name: string }[];
  practitioners: { staffId: string; name: string }[];
};

type VoiceLanguage = "en" | "hi" | "kn" | "ta" | "te" | "ml" | "mr" | "bn" | "gu" | "pa" | "od";
type SpokenSettings = {
  displayName: string;
  greeting: string;
  languages: VoiceLanguage[];
  defaultLanguage: VoiceLanguage;
  voiceId: string | null;
  tone: "professional" | "warm" | "concise";
  speakingRate: number;
  maxCallSeconds: number;
  actions: { book: boolean; lookup: boolean; cancel: boolean; reschedule: boolean };
  consultationTypes: ("in_person" | "virtual")[];
  humanTransferNumber: string | null;
  failureAction: "take_callback" | "transfer" | "end_call";
  recordingEnabled: boolean;
};
type VoiceRequest = {
  id: string;
  kind: "create" | "changes";
  state: "pending" | "in_setup" | "completed" | "declined";
  revision: number;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  reason: string | null;
};
type AgentSettings = {
  customerId: string;
  entitled: boolean;
  voiceStatus: string;
  agent: { agentId: string; appVersion: number; displayName: string; phoneNumber: string | null } | null;
  request: VoiceRequest | null;
  desiredRevision: number;
  activeRevision: number;
  revisionState: string | null;
  settings: SpokenSettings;
};
const openRequest = (request: VoiceRequest | null) =>
  request?.state === "pending" || request?.state === "in_setup" ? request : null;
const when = (value: string) => new Date(value).toLocaleString();
const LANGUAGES: [VoiceLanguage, string][] = [
  ["en", "English"], ["hi", "Hindi"], ["kn", "Kannada"], ["ta", "Tamil"], ["te", "Telugu"],
  ["ml", "Malayalam"], ["mr", "Marathi"], ["bn", "Bengali"], ["gu", "Gujarati"], ["pa", "Punjabi"], ["od", "Odia"],
];
const BOOKING_ACTIONS: [keyof SpokenSettings["actions"], string][] = [
  ["book", "Book"], ["lookup", "Look up"], ["cancel", "Cancel"], ["reschedule", "Reschedule"],
];

function AssignedVoiceNumber() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/public/v1/voice/config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((runtime: VoiceRuntime | null) => {
        if (!cancelled) setPhoneNumber(runtime?.phone_number ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!phoneNumber) return null;

  return (
    <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <PhoneCall className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your hospital&apos;s voice agent number
            </p>
            <a
              className="text-xl font-semibold hover:underline"
              href={`tel:${phoneNumber}`}
            >
              {phoneNumber}
            </a>
            <p className="text-xs text-muted-foreground">
              Patient calls to this number are answered by your dedicated voice
              agent.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700"
        >
          Active · Dedicated to this tenant
        </Badge>
      </CardContent>
    </Card>
  );
}

function useAgentSettings() {
  const { facility } = useWorkspace();
  const [poll, setPoll] = useState(0);
  const query = useQuery<AgentSettings>(`/v1/voice/agent-settings?facilityId=${facility.facilityId}`, poll);
  // While Exora works on a request, refresh now and then so the page turns live without a reload.
  const waiting = !!openRequest(query.data?.request ?? null);
  useEffect(() => {
    setPoll(waiting ? 15000 : 0);
  }, [waiting]);
  return query;
}

function VoiceControl() {
  const agent = useAgentSettings();
  const [runtime, setRuntime] = useState<VoiceRuntime | null>(null);
  const [booking, setBooking] = useState<BookingBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [voiceResponse, bookingResponse] = await Promise.all([
        fetch("/public/v1/voice/config", { cache: "no-store" }),
        fetch("/public/v1/bootstrap", { cache: "no-store" }),
      ]);
      if (!voiceResponse.ok || !bookingResponse.ok)
        throw new Error("The tenant runtime did not pass its readiness check.");
      setRuntime((await voiceResponse.json()) as VoiceRuntime);
      setBooking((await bookingResponse.json()) as BookingBootstrap);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The voice status could not be checked.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = runtime?.enabled === true;
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const hostedSecurely = location.protocol === "https:" && !local;
  const steps = [
    {
      label: "Tenant booking connection",
      detail: runtime?.integration_ready
        ? "The isolated voice service identity is installed."
        : "Voice has not been enabled for this tenant.",
      ready: runtime?.integration_ready === true,
    },
    {
      label: "Public HTTPS address",
      detail: hostedSecurely
        ? "This workspace is running behind public HTTPS."
        : local
          ? "Local preview only. Host this tenant before provider activation."
          : "HTTPS is required for provider tools and microphone access.",
      ready: hostedSecurely,
    },
    {
      label: "Tenant-specific Sarvam agent",
      detail: agent.data?.agent
        ? `${agent.data.agent.displayName} · version ${agent.data.agent.appVersion}`
        : openRequest(agent.data?.request ?? null)
          ? "Requested. Exora is setting up this clinic's agent."
          : "Not created yet. Use Create voice agent below.",
      ready: !!agent.data?.agent,
    },
    {
      label: "Patient website calling",
      detail: active
        ? "The consent-gated browser call is available to patients."
        : "The call control stays hidden until the approved agent is active.",
      ready: active,
    },
  ];

  return (
    <section className="space-y-4" aria-label="Voice setup and testing">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Voice agent control</h2>
            <Badge variant={active ? "default" : "secondary"}>
              {active
                ? "Active"
                : runtime?.state === "awaiting_sarvam_agent"
                  ? "Awaiting Sarvam agent"
                  : "Not enabled"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Setup, live readiness and safe tenant-level testing in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Check status
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
          >
            <Globe2 /> Booking website <ArrowUpRight />
          </Button>
          {active && (
            <Button
              onClick={() =>
                window.open("/#voice", "_blank", "noopener,noreferrer")
              }
            >
              <Bot /> Test voice call <ArrowUpRight />
            </Button>
          )}
        </div>
      </div>

      {(error || agent.error) && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error || agent.error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <Card key={step.label}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                {step.ready ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDashed className="mt-0.5 size-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agent.data && !agent.data.agent && (
        <AgentRequestCard setup={agent.data} refresh={agent.refresh} />
      )}
      {agent.data?.agent && (
        <SpokenAgentForm
          key={agent.data.desiredRevision}
          setup={agent.data}
          refresh={agent.refresh}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" /> Booking data test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {busy && !booking ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Checking tenant
                data…
              </p>
            ) : booking ? (
              <>
                <p>
                  <strong>{booking.facilities.length}</strong> branch
                  {booking.facilities.length === 1 ? "" : "es"} and{" "}
                  <strong>{booking.practitioners.length}</strong> doctor
                  {booking.practitioners.length === 1 ? "" : "s"} are visible to
                  the booking system.
                </p>
                <p className="text-xs text-muted-foreground">
                  This confirms the website data path. Voice tools use the same
                  tenant database through a separate server-only credential.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Run the status check again.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> How to test safely
            </CardTitle>
          </CardHeader>
          <CardContent>
            {active ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Open the patient website and scroll to Voice front desk.
                </li>
                <li>
                  Accept the displayed consent notice and allow microphone
                  access.
                </li>
                <li>
                  Ask for a doctor and a live slot, then book a test
                  appointment.
                </li>
                <li>
                  Return here to confirm the call and booking in Call history.
                </li>
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Local booking data can be tested now. A real browser call cannot
                be tested until the tenant has a public HTTPS address and its
                dedicated Sarvam agent has been tested, committed and bound by
                the Exora platform administrator.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function AgentRequestCard({ setup, refresh }: { setup: AgentSettings; refresh: () => Promise<boolean> }) {
  const { facility, can } = useWorkspace();
  const canManage = can("voice.manage");
  const cmd = useCommand();
  const pending = openRequest(setup.request);
  const declined = setup.request?.kind === "create" && setup.request.state === "declined" ? setup.request : null;
  async function create() {
    const result = await cmd.run(`/v1/voice/agent-request`, { facilityId: facility.facilityId }, true);
    if (result) await refresh();
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" /> Voice agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!setup.entitled ? (
          <p className="text-muted-foreground">
            A voice agent is not included in this clinic&apos;s plan. Contact Exora to add it.
          </p>
        ) : pending ? (
          <>
            <Badge variant="secondary">
              {pending.state === "in_setup" ? "Being set up" : "Requested"}
            </Badge>
            <p>
              Requested by {pending.requestedBy} on {when(pending.requestedAt)}.{" "}
              {pending.state === "in_setup"
                ? "Exora is setting up your agent now."
                : "Exora will set up your agent using this clinic's details."}
            </p>
            <p className="text-xs text-muted-foreground">
              This page updates on its own when the agent is ready. You can then change how it speaks here.
            </p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Exora creates a dedicated voice agent for this clinic. It answers patients using your live
              doctors, schedules and booking rules.
            </p>
            {declined?.reason && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                Your last request was declined: {declined.reason}
              </p>
            )}
            {cmd.error && <p className="text-destructive">{cmd.error}</p>}
            <Button type="button" disabled={!canManage || cmd.busy} onClick={() => void create()}>
              {cmd.busy ? <LoaderCircle className="animate-spin" /> : <Bot />} Create voice agent
            </Button>
            {!canManage && (
              <p className="text-xs text-muted-foreground">Only a clinic administrator can request the agent.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpokenAgentForm({ setup, refresh }: { setup: AgentSettings; refresh: () => Promise<boolean> }) {
  const { facility, can } = useWorkspace();
  const canManage = can("voice.manage");
  const [settings, setSettings] = useState<SpokenSettings>(setup.settings);
  const [notice, setNotice] = useState("");
  const cmd = useCommand();
  const dirty = JSON.stringify(settings) !== JSON.stringify(setup.settings);
  const pending = openRequest(setup.request);
  const declined = setup.request?.kind === "changes" && setup.request.state === "declined" && setup.revisionState === "failed"
    ? setup.request : null;
  const requestable = !dirty && setup.revisionState === "draft" && setup.desiredRevision > setup.activeRevision;
  useUnsaved(dirty);
  const update = (patch: Partial<SpokenSettings>) => {
    setSettings({ ...settings, ...patch });
    setNotice("");
  };
  function toggleLanguage(code: VoiceLanguage) {
    const languages = settings.languages.includes(code)
      ? settings.languages.filter((item) => item !== code)
      : [...settings.languages, code];
    if (languages.length === 0) return;
    update({
      languages,
      defaultLanguage: languages.includes(settings.defaultLanguage) ? settings.defaultLanguage : languages[0] ?? settings.defaultLanguage,
    });
  }
  function payload(): SpokenSettings {
    return {
      ...settings,
      voiceId: settings.voiceId?.trim() || null,
      humanTransferNumber: settings.humanTransferNumber?.trim() || null,
    };
  }
  async function saveDraft() {
    const result = await cmd.run(`/v1/voice/agent-settings`, {
      facilityId: facility.facilityId,
      expectedRevision: setup.desiredRevision,
      settings: payload(),
    }, false, "PUT");
    if (result) {
      setNotice("Draft saved. Request the changes when you are ready for Exora to apply them.");
      await refresh();
    }
  }
  async function requestChanges() {
    const result = await cmd.run(`/v1/voice/agent-settings/request-changes`, {
      facilityId: facility.facilityId,
      revision: setup.desiredRevision,
    }, true);
    if (result) {
      setNotice("");
      await refresh();
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spoken agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {pending && (
          <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            Changes requested by {pending.requestedBy} on {when(pending.requestedAt)}.{" "}
            {pending.state === "in_setup" ? "Exora is applying them now." : "Exora will apply them to your agent."}{" "}
            Editing is paused until then.
          </p>
        )}
        {declined?.reason && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Your last change request was declined: {declined.reason}
          </p>
        )}
        <fieldset disabled={!canManage || cmd.busy || !!pending} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="voice-display-name">Display name</Label>
            <Input id="voice-display-name" value={settings.displayName} maxLength={80}
              onChange={(event) => update({ displayName: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-greeting">Greeting</Label>
            <Textarea id="voice-greeting" value={settings.greeting} maxLength={1000}
              onChange={(event) => update({ greeting: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-4">
              {LANGUAGES.map(([code, label]) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.languages.includes(code)} onChange={() => toggleLanguage(code)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <WorkspaceChoice label="Default language" value={settings.defaultLanguage}
            onChange={(value) => update({ defaultLanguage: value as VoiceLanguage })}
            options={LANGUAGES.filter(([code]) => settings.languages.includes(code)).map(([value, label]) => ({ value, label }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voice-pace">Speaking rate ({settings.speakingRate.toFixed(2)})</Label>
              <Input id="voice-pace" type="range" min={0.8} max={1.2} step={0.05} value={settings.speakingRate}
                onChange={(event) => update({ speakingRate: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-max-call">Max call length (seconds)</Label>
              <Input id="voice-max-call" type="number" min={60} max={3600} value={settings.maxCallSeconds}
                onChange={(event) => update({ maxCallSeconds: Number(event.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Booking actions</Label>
            <div className="flex flex-wrap gap-4">
              {BOOKING_ACTIONS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.actions[key]}
                    onChange={(event) => update({ actions: { ...settings.actions, [key]: event.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-transfer">Human-transfer number</Label>
            <Input id="voice-transfer" placeholder="+919876543210" value={settings.humanTransferNumber ?? ""}
              onChange={(event) => update({ humanTransferNumber: event.target.value || null })} />
          </div>
        </fieldset>
        {(cmd.error || notice) && <p className={cmd.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{cmd.error || notice}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!canManage || cmd.busy || !dirty || !!pending} onClick={() => void saveDraft()}>Save draft</Button>
          <Button type="button" disabled={!canManage || cmd.busy || !requestable || !!pending} onClick={() => void requestChanges()}>Request changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Voice() {
  const [tab, open] = useWorkspaceTab("voice");
  const { me, facility } = useWorkspace();
  const source = useMemo(() => voiceSource(me, facility), [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <Tabs
        value={tab}
        onValueChange={(value) => open(value as "history" | "setup")}
        className="arc-workflow-root"
      >
        <div className="arc-demo-scope mb-6">
          <TabsList aria-label="Voice workspace">
            <TabsTrigger value="history">Call history</TabsTrigger>
            <TabsTrigger value="setup">Call setup</TabsTrigger>
          </TabsList>
        </div>
        <AssignedVoiceNumber />
        <TabsContent value="setup" className="arc-workflow-panel">
          <div className="space-y-8">
            <VoiceControl />
            <ChannelOnboarding channel="voice" />
          </div>
        </TabsContent>
        <TabsContent value="history" className="arc-workflow-panel">
          <VoiceModule
            recordingLoader={(id) =>
              requestBytes(`/v1/voice-calls/${id}/recording`)
            }
          />
        </TabsContent>
      </Tabs>
    </OriginalResourceContext.Provider>
  );
}
