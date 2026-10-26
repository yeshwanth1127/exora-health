import { useState } from "react";
import {
  AppleMessagesOnboardingDraftSchema,
  ChannelOnboardingSchema,
  type ChannelOnboardingDraft,
} from "@hms/contracts";
import { Alert } from "@/components/arc/alert/alert";
import { Stepper } from "@/components/arc/stepper/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APPLE_STEPS, appleStep } from "./apple-setup";
import { CommandReceiptRecovery } from "./CommandReceiptRecovery";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";

type AppleDraft = Extract<ChannelOnboardingDraft, { channel: "apple_messages" }>;
const parseSetup = (value: unknown) => ChannelOnboardingSchema.parse(value);
type Setup = ReturnType<typeof parseSetup>;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DETAILS = { brandName: true, website: true, businessPhone: true, supportEmail: true, languages: true, greeting: true } as const;
const issues = (e: { issues: { message: string }[] }) => e.issues.map((i) => i.message).join(". ");

function blank(name: string, timezone: string): AppleDraft {
  return {
    channel: "apple_messages",
    brandName: name,
    website: "",
    businessPhone: "",
    supportEmail: "",
    languages: ["en"],
    greeting: "Hello! How can we help with your appointment?",
    humanHandoff: "on_request",
    supportTimezone: timezone,
    supportHours: [1, 2, 3, 4, 5].map((day) => ({ day, from: "09:00", to: "17:00" })),
    afterHoursMessage: "Thanks for your message. Reception will reply during support hours.",
    authorizedToRepresentClinic: true,
  };
}

/** Apple Messages setup request. Saving or submitting never connects Apple: only a configured connection is live. */
export function AppleSetup({ live, onOpenConversations }: { live: boolean; onOpenConversations: () => void }) {
  const { facility } = useWorkspace();
  const q = useQuery(`/v1/channel-onboarding/apple_messages?facilityId=${facility.facilityId}`, 0, parseSetup);
  return (
    <section className="space-y-6" aria-label="Apple Messages setup">
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight">
          {live ? "Apple Messages is live" : "Set up Apple Messages"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          iPhone users message your clinic from Maps, Safari or Search. You add your details; Exora handles Apple.
        </p>
      </div>
      {!live && (
        <div className="arc-demo-scope max-w-2xl">
          <Alert tone="warning" title="Eligibility is not confirmed">
            Apple isn&apos;t currently onboarding businesses whose main service is medical. Exora confirms eligibility with Apple before anything goes live.
          </Alert>
        </div>
      )}
      {q.error && <p role="alert" className="text-sm text-destructive">{q.error}</p>}
      {q.loading && !q.data && <p className="text-sm text-muted-foreground">Loading setup…</p>}
      {q.data && (
        <AppleSetupForm
          key={q.data.version}
          setup={q.data}
          refresh={q.refresh}
          live={live}
          onOpenConversations={onOpenConversations}
        />
      )}
    </section>
  );
}

function AppleSetupForm({
  setup,
  refresh,
  live,
  onOpenConversations,
}: {
  setup: Setup;
  refresh: () => Promise<boolean>;
  live: boolean;
  onOpenConversations: () => void;
}) {
  const { facility, can } = useWorkspace();
  const saved = setup.draft?.channel === "apple_messages" ? setup.draft : null;
  const initial = saved ?? blank(facility.name, facility.timezone);
  const [draft, setDraft] = useState<AppleDraft>(initial);
  const [authorized, setAuthorized] = useState(!!saved);
  const [local, setLocal] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState("");
  const cmd = useCommand();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || authorized !== !!saved;
  useUnsaved(dirty);
  const current = appleStep(setup.state, live, local);
  const open = picked !== null && picked < current ? picked : Math.min(current, APPLE_STEPS.length - 1);
  const step = APPLE_STEPS[open]!.id;
  const canManage = can("comms.manage");
  const locked = !canManage || cmd.busy || cmd.unknown || setup.state === "requested";
  const update = (patch: Partial<AppleDraft>) => {
    setDraft({ ...draft, ...patch });
    setError("");
  };

  function next() {
    // The schema is strict, so check only this page's fields.
    const { brandName, website, businessPhone, supportEmail, languages, greeting } = draft;
    const parsed = AppleMessagesOnboardingDraftSchema.pick(DETAILS).safeParse({ brandName, website, businessPhone, supportEmail, languages, greeting });
    if (!parsed.success) return setError(issues(parsed.error));
    setError("");
    if (current > 1) setPicked(1);
    else setLocal(1);
  }
  async function save() {
    if (!authorized) return setError("Confirm that you can represent this clinic.");
    const parsed = AppleMessagesOnboardingDraftSchema.safeParse(draft);
    if (!parsed.success) return setError(issues(parsed.error));
    const result = await cmd.run(
      "/v1/channel-onboarding/apple_messages",
      { facilityId: setup.facilityId, version: setup.version, draft: parsed.data },
      true,
      "PUT",
    );
    if (result) await refresh();
  }
  async function submit() {
    const result = await cmd.run(
      "/v1/channel-onboarding/apple_messages/submit",
      { facilityId: setup.facilityId, version: setup.version },
      true,
    );
    if (result) await refresh();
  }
  function toggleDay(day: number) {
    const has = draft.supportHours.some((d) => d.day === day);
    update({
      supportHours: has
        ? draft.supportHours.filter((d) => d.day !== day)
        : [...draft.supportHours, { day, from: "09:00", to: "17:00" }].sort((a, b) => a.day - b.day),
    });
  }
  function setTime(day: number, key: "from" | "to", value: string) {
    update({ supportHours: draft.supportHours.map((d) => (d.day === day ? { ...d, [key]: value } : d)) });
  }

  return (
    <>
      <div className="arc-demo-scope max-w-3xl">
        <Stepper
          label="Apple Messages setup"
          current={current}
          onStepSelect={setPicked}
          details="current"
          completeLabel="Apple Messages live"
          steps={[...APPLE_STEPS]}
        />
      </div>
      {!canManage && (
        <p className="text-sm text-muted-foreground">Only a clinic administrator can change this setup.</p>
      )}
      {setup.state === "requested" && open < 3 && (
        <p className="text-sm text-muted-foreground">Editing is paused while Exora reviews your request.</p>
      )}

      {step === "details" && (
        <Card>
          <CardContent className="pt-5">
            <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
              <Field id="apple-brand" label="Clinic name">
                <Input id="apple-brand" value={draft.brandName} maxLength={150} onChange={(e) => update({ brandName: e.target.value })} />
              </Field>
              <Field id="apple-website" label="Website">
                <Input id="apple-website" placeholder="https://" value={draft.website} onChange={(e) => update({ website: e.target.value })} />
              </Field>
              <Field id="apple-phone" label="Business phone">
                <Input id="apple-phone" placeholder="+919876543210" value={draft.businessPhone} onChange={(e) => update({ businessPhone: e.target.value })} />
              </Field>
              <Field id="apple-email" label="Support email">
                <Input id="apple-email" type="email" value={draft.supportEmail} onChange={(e) => update({ supportEmail: e.target.value })} />
              </Field>
              <div className="space-y-2 sm:col-span-2">
                <Label>Languages</Label>
                <div className="flex gap-5 text-sm">
                  {([["en", "English"], ["es", "Spanish"]] as const).map(([code, name]) => (
                    <label key={code} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.languages.includes(code)}
                        onChange={(e) =>
                          update({ languages: e.target.checked ? [...draft.languages, code] : draft.languages.filter((l) => l !== code) })
                        }
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Field id="apple-greeting" label="Greeting">
                  <Textarea id="apple-greeting" rows={2} value={draft.greeting} onChange={(e) => update({ greeting: e.target.value })} />
                </Field>
              </div>
            </fieldset>
            <Footer error={error} cmd={cmd} refresh={refresh}>
              <Button disabled={locked} onClick={next}>Continue</Button>
            </Footer>
          </CardContent>
        </Card>
      )}

      {step === "hours" && (
        <Card>
          <CardContent className="pt-5">
            <fieldset disabled={locked} className="space-y-5">
              <Field id="apple-timezone" label="Time zone">
                <Input id="apple-timezone" className="max-w-xs" value={draft.supportTimezone} onChange={(e) => update({ supportTimezone: e.target.value })} />
              </Field>
              <div className="space-y-2">
                <Label>Reception replies on</Label>
                <ul className="space-y-2 text-sm">
                  {DAYS.map((name, i) => {
                    const day = draft.supportHours.find((d) => d.day === i + 1);
                    return (
                      <li key={name} className="flex flex-wrap items-center gap-3">
                        <label className="flex w-32 items-center gap-2">
                          <input type="checkbox" checked={!!day} onChange={() => toggleDay(i + 1)} />
                          {name}
                        </label>
                        {day && (
                          <>
                            <div className="w-36"><Input type="time" aria-label={`${name} from`} value={day.from} onChange={(e) => setTime(i + 1, "from", e.target.value)} /></div>
                            <span className="text-muted-foreground">to</span>
                            <div className="w-36"><Input type="time" aria-label={`${name} to`} value={day.to} onChange={(e) => setTime(i + 1, "to", e.target.value)} /></div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <Field id="apple-after-hours" label="After-hours reply">
                <Textarea id="apple-after-hours" rows={2} value={draft.afterHoursMessage} onChange={(e) => update({ afterHoursMessage: e.target.value })} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={authorized} onChange={(e) => { setAuthorized(e.target.checked); setError(""); }} />
                I&apos;m allowed to represent this clinic. Exora and Apple still verify this.
              </label>
            </fieldset>
            <Footer error={error} cmd={cmd} refresh={refresh}>
              <Button disabled={locked || (!dirty && setup.version > 0)} onClick={() => void save()}>Save</Button>
            </Footer>
          </CardContent>
        </Card>
      )}

      {step === "submit" && (
        <Card>
          <CardContent className="space-y-4 pt-5 text-sm">
            <p>
              {draft.brandName} · {draft.website} · {draft.supportHours.length} support day{draft.supportHours.length === 1 ? "" : "s"}
            </p>
            <p className="text-muted-foreground">Submitting sends this to Exora. It doesn&apos;t connect Apple Messages.</p>
            <Footer error={error} cmd={cmd} refresh={refresh}>
              <Button disabled={locked || dirty} onClick={() => void submit()}>Submit request</Button>
            </Footer>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Submitted{setup.requestedAt ? ` ${new Date(setup.requestedAt).toLocaleDateString()}` : ""}. Exora checks eligibility with Apple and
            connects your account. Nothing goes live until then.
          </CardContent>
        </Card>
      )}

      {step === "live" && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5 text-sm">
            <p>Patients can message your clinic from their iPhone.</p>
            <Button onClick={onOpenConversations}>Open conversations</Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Footer({
  error,
  cmd,
  refresh,
  children,
}: {
  error: string;
  cmd: ReturnType<typeof useCommand>;
  refresh: () => Promise<boolean>;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 space-y-3 border-t pt-4">
      {(error || cmd.error) && <p role="alert" className="text-sm text-destructive">{error || cmd.error}</p>}
      <CommandReceiptRecovery command={cmd} onConfirmed={() => void refresh()} />
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
