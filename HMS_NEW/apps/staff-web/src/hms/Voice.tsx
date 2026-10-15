import { requestLeave } from "./leave";
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
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { VoiceModule } from "@/modules/voice";
import { OriginalResourceContext } from "@/components/resource-source";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { voiceSource } from "./voice-source";
import { useWorkspace } from "./hooks";
import { requestBytes } from "./client";

type VoiceRuntime = {
  enabled: boolean;
  integration_ready: boolean;
  agent_ready: boolean;
  state: "active" | "awaiting_sarvam_agent" | "not_requested";
  app_id?: string;
  version?: number;
  agent_name?: string;
  recording_notice?: string;
  session_seconds?: number;
};

type BookingBootstrap = {
  facilities: { facilityId: string; name: string }[];
  practitioners: { staffId: string; name: string }[];
};

function VoiceControl() {
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
      detail: runtime?.agent_ready
        ? `${runtime.agent_name ?? "Agent"} · version ${runtime.version ?? "—"}`
        : "Waiting for the platform administrator to clone, test and bind the agent.",
      ready: runtime?.agent_ready === true,
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
          <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
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

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
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
                <LoaderCircle className="size-4 animate-spin" /> Checking tenant data…
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
              <p className="text-muted-foreground">Run the status check again.</p>
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
                <li>Open the patient website and scroll to Voice front desk.</li>
                <li>Accept the displayed consent notice and allow microphone access.</li>
                <li>Ask for a doctor and a live slot, then book a test appointment.</li>
                <li>Return here to confirm the call and booking in Call history.</li>
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Local booking data can be tested now. A real browser call cannot be
                tested until the tenant has a public HTTPS address and its dedicated
                Sarvam agent has been tested, committed and bound by the Exora
                platform administrator.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function Voice() {
  const [setup, setSetup] = useState(false);
  const { me, facility } = useWorkspace();
  const source = useMemo(() => voiceSource(me, facility), [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <div className="mb-6 flex gap-2">
        <Button
          variant={setup ? "default" : "outline"}
          onClick={() => requestLeave(() => setSetup(true))}
        >
          Call setup
        </Button>
        <Button
          variant={!setup ? "default" : "outline"}
          onClick={() => requestLeave(() => setSetup(false))}
        >
          Call history
        </Button>
      </div>
      {setup ? (
        <div className="space-y-8">
          <VoiceControl />
          <ChannelOnboarding channel="voice" />
        </div>
      ) : (
        <VoiceModule
          recordingLoader={(id) =>
            requestBytes(`/v1/voice-calls/${id}/recording`)
          }
        />
      )}
    </OriginalResourceContext.Provider>
  );
}
