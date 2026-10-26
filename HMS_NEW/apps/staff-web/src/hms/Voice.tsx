import { useWorkspaceTab } from "./use-workspace-tab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/arc/tabs/tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChannelOnboarding, strategies, useChannelSetup } from "./ChannelOnboarding";
import { StepList } from "./StepList";
import { PageTitle } from "@/components/workspace";
import { Stepper } from "@/components/arc/stepper/stepper";
import { VOICE_STEPS, voiceStep } from "./voice-setup";
import {
  ArrowUpRight,
  Bot,
  Headphones,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
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

function useVoiceRuntime() {
  const [runtime, setRuntime] = useState<VoiceRuntime | null>(null);
  const [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/public/v1/voice/config", { cache: "no-store" });
      setRuntime(response.ok ? ((await response.json()) as VoiceRuntime) : null);
    } catch {
      setRuntime(null);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { runtime, busy, refresh };
}

function AssignedVoiceNumber({ phoneNumber }: { phoneNumber: string | null | undefined }) {
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
              Your voice agent number
            </p>
            <a
              className="text-xl font-semibold hover:underline"
              href={`tel:${phoneNumber}`}
            >
              {phoneNumber}
            </a>
            <p className="text-xs text-muted-foreground">
              Your agent answers calls to this number.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700"
        >
          Active
        </Badge>
      </CardContent>
    </Card>
  );
}

function useAgentSettings() {
  const { facility } = useWorkspace();
  const [poll, setPoll] = useState(0);
  const query = useQuery<AgentSettings>(`/v1/voice/agent-settings?facilityId=${facility.facilityId}`, poll);
  // While a request waits for approval, refresh now and then so the page turns live without a reload.
  const waiting = !!openRequest(query.data?.request ?? null);
  useEffect(() => {
    setPoll(waiting ? 15000 : 0);
  }, [waiting]);
  return query;
}

/** Before the agent is live: one guided page, no tabs (WhatsApp's pattern). */
function VoiceGuide({ runtime }: { runtime: ReturnType<typeof useVoiceRuntime> }) {
  const { facility, practitioners, go, can } = useWorkspace();
  const agent = useAgentSettings();
  const line = useChannelSetup("voice");
  const [picked, setPicked] = useState<string | null>(null);
  const doctors = practitioners.filter((p) => p.facilityId === facility.facilityId);
  const pending = openRequest(agent.data?.request ?? null);
  const reached = voiceStep({
    doctors: doctors.length,
    line: line.data?.state ?? null,
    agent: agent.data ? { exists: !!agent.data.agent, request: agent.data.request?.state ?? null } : null,
    live: false,
  });
  const index = (id: string) => VOICE_STEPS.findIndex((s) => s.id === id);
  const open = picked && index(picked) <= reached ? picked : VOICE_STEPS[Math.min(reached, VOICE_STEPS.length - 1)]!.id;
  // The control plane answers 412 until voice is switched on for this clinic.
  const notEnabled = !!agent.error && /not configured/i.test(agent.error);
  const draft = line.data?.draft?.channel === "voice" ? line.data.draft : null;
  const { refresh } = runtime;
  useEffect(() => {
    if (!pending && !agent.data?.agent) return;
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [pending, agent.data?.agent, refresh]);
  const summaries: Record<string, string> = {
    doctors: `${doctors.length} doctor${doctors.length === 1 ? "" : "s"} can be booked`,
    line: draft ? (strategies.voice.find(([v]) => v === draft.numberStrategy)?.[1] ?? "") : "",
    request: pending ? `Submitted ${new Date(pending.requestedAt).toLocaleDateString()}` : "Submitted",
  };
  const body = (id: string) =>
    id === "doctors" ? (
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <p>
          {doctors.length
            ? `${doctors.length} doctor${doctors.length === 1 ? "" : "s"} at ${facility.name} can be booked by the agent.`
            : "Add a doctor with working hours. The agent only offers real open times."}
        </p>
        <Button variant={doctors.length ? "outline" : "default"} onClick={() => go("doctors")}>
          {doctors.length ? "Open Doctors" : "Add a doctor"}
        </Button>
      </div>
    ) : id === "line" ? (
      <ChannelOnboarding q={line} />
    ) : id === "request" ? (
      agent.data ? (
        <AgentRequest setup={agent.data} refresh={agent.refresh} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {agent.loading
            ? "Checking status…"
            : notEnabled
              ? "Voice isn't available for your clinic yet."
              : "Couldn't load the status. Try Check status."}
        </p>
      )
    ) : (
      <p className="text-sm">
        {agent.data?.agent
          ? "Approved. Your agent goes live soon."
          : pending
            ? `Application submitted to Paperwhale on ${new Date(pending.requestedAt).toLocaleDateString()}. Wait for approval.`
            : "Submit your application first."}
      </p>
    );
  return (
    <>
      <PageTitle
        title="Voice agent"
        icon={<Headphones className="size-7" />}
        action={
          <Button variant="outline" disabled={runtime.busy} onClick={() => { void refresh(); void agent.refresh(); void line.refresh(); }}>
            {runtime.busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Check status
          </Button>
        }
      />
      <div className="mb-6 max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight">Set up your voice agent</h2>
        <p className="mt-1 text-sm text-muted-foreground">Answers patient calls and books appointments.</p>
        <div className="arc-demo-scope mt-4">
          <Stepper
            label="Voice agent setup"
            current={reached}
            completeLabel="Approved"
            steps={VOICE_STEPS.map((s) => ({
              id: s.id,
              label: s.label,
              error: s.id === "request" && reached === 2 && agent.error ? (notEnabled ? "Not available yet" : "Status unavailable") : undefined,
            }))}
          />
        </div>
      </div>
      {!can("voice.manage") && (
        <p className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          Your administrator needs to finish voice setup. You can follow progress here.
        </p>
      )}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <StepList
          steps={VOICE_STEPS.map((s) => ({ id: s.id, title: s.label, hint: s.description, summary: summaries[s.id] }))}
          reached={reached}
          open={open}
          onOpen={setPicked}
          body={body}
          canManage={can("voice.manage")}
        />
        <div className="xl:sticky xl:top-6">
          <p className="mb-3 text-xs font-medium text-muted-foreground">What patients hear</p>
          <CallPreview
            clinic={facility.name}
            doctor={doctors[0]?.name ?? null}
            greeting={agent.data?.settings.greeting || draft?.greeting || `Hello, you've reached ${facility.name}. How can I help?`}
          />
        </div>
      </div>
    </>
  );
}

/** An example call using this clinic's name, greeting and first doctor; the times are illustrative. */
function CallPreview({ clinic, doctor, greeting }: { clinic: string; doctor: string | null; greeting: string }) {
  const line = (text: string, patient = false) => (
    <div className={`flex ${patient ? "justify-end" : "justify-start"}`}>
      <p className={`max-w-[85%] rounded-2xl px-3 py-2 ${patient ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{text}</p>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-foreground/85 bg-background shadow-sm">
      <div className="flex flex-col items-center gap-1.5 bg-foreground px-4 pb-5 pt-7 text-background">
        <div className="grid size-14 place-items-center rounded-full bg-background/15 text-lg font-semibold">
          {clinic.slice(0, 1)}
        </div>
        <p className="font-medium">{clinic}</p>
        <p className="flex items-center gap-1.5 text-xs opacity-70">
          <PhoneCall className="size-3" /> Voice agent
        </p>
      </div>
      <div className="space-y-2 p-3 text-[13px] leading-snug">
        {line(greeting)}
        {line("I'd like to see a doctor tomorrow.", true)}
        {line(doctor ? `${doctor} is free at 10:30 or 11:00. Which suits you?` : "Which doctor would you like to see?")}
        {line("10:30, please.", true)}
        {line(`You're booked${doctor ? ` with ${doctor}` : ""} for tomorrow at 10:30.`)}
      </div>
    </div>
  );
}

function AgentRequest({ setup, refresh }: { setup: AgentSettings; refresh: () => Promise<boolean> }) {
  const { facility, can } = useWorkspace();
  const canManage = can("voice.manage");
  const cmd = useCommand();
  const declined = setup.request?.kind === "create" && setup.request.state === "declined" ? setup.request : null;
  async function create() {
    const result = await cmd.run(`/v1/voice/agent-request`, { facilityId: facility.facilityId }, true);
    if (result) await refresh();
  }
  if (!setup.entitled)
    return <p className="text-sm text-muted-foreground">Voice agent isn&apos;t in your plan. Contact Paperwhale to add it.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Your agent books from your doctors and their open times.</p>
      {declined?.reason && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
          Your last application was declined: {declined.reason}
        </p>
      )}
      {cmd.error && <p className="text-destructive">{cmd.error}</p>}
      <Button type="button" disabled={!canManage || cmd.busy} onClick={() => void create()}>
        {cmd.busy ? <LoaderCircle className="animate-spin" /> : <Bot />} Submit application
      </Button>
      {!canManage && <p className="text-xs text-muted-foreground">Only a clinic administrator can submit this.</p>}
    </div>
  );
}

/** After the agent is live: test it and change how it speaks. */
function VoiceSettings() {
  const agent = useAgentSettings();
  return (
    <section className="space-y-6" aria-label="Voice settings">
      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <p>Test it before patients call:</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Open the booking website and start a voice call.</li>
            <li>Accept the consent notice and allow the microphone.</li>
            <li>Book a test appointment, then check Call history.</li>
          </ol>
          <Button onClick={() => window.open("/#voice", "_blank", "noopener,noreferrer")}>
            <Bot /> Test voice call <ArrowUpRight />
          </Button>
        </CardContent>
      </Card>
      {agent.error && <p role="alert" className="text-sm text-destructive">Couldn&apos;t load the agent settings.</p>}
      {agent.data && <SpokenAgentForm key={agent.data.desiredRevision} setup={agent.data} refresh={agent.refresh} />}
    </section>
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
      setNotice("Draft saved.");
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
            Changes submitted on {when(pending.requestedAt)}. Wait for approval.
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
  const runtime = useVoiceRuntime();
  if (runtime.busy && !runtime.runtime) return <p className="text-sm text-muted-foreground">Loading voice…</p>;
  if (runtime.runtime?.enabled !== true) return <VoiceGuide runtime={runtime} />;
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
        <AssignedVoiceNumber phoneNumber={runtime.runtime.phone_number} />
        <TabsContent value="setup" className="arc-workflow-panel">
          <VoiceSettings />
        </TabsContent>
        <TabsContent value="history" className="arc-workflow-panel">
          <VoiceModule
            onSetup={() => open("setup")}
            recordingLoader={(id) =>
              requestBytes(`/v1/voice-calls/${id}/recording`)
            }
          />
        </TabsContent>
      </Tabs>
    </OriginalResourceContext.Provider>
  );
}
