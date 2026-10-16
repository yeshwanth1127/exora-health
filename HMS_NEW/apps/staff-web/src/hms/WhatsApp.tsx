import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/workspace";
import { WhatsAppIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useManagedSetup, connectMeta } from "./managed-whatsapp";
import { useWorkspace } from "./hooks";
import {
  chatLink,
  currentStage,
  shapes,
  stageOrder,
  stepInfo,
  stepsFor,
  suggestShape,
  validPhone,
  type ClinicShape,
  type FlowStep,
  type Stage,
  type WhatsAppSetup,
} from "./whatsapp-setup";
import {
  Bubble,
  Choices,
  HeaderPreview,
  StepDot,
  type Clinic,
} from "./whatsapp-ui";
import { Live } from "./WhatsAppLive";
import { useClinicBasics } from "./clinic-basics";

export type Patch =
  Partial<WhatsAppSetup> | ((old: WhatsAppSetup) => Partial<WhatsAppSetup>);
export function WhatsApp() {
  const { facility } = useWorkspace();
  return <WhatsAppPage key={facility.facilityId} />;
}

function WhatsAppPage() {
  const basics = useClinicBasics();
  if (basics.loading)
    return <p className="text-sm text-muted-foreground">Loading WhatsApp…</p>;
  return <Setup clinic={basics.clinic} />;
}

const titles: Record<Exclude<Stage, "live">, [string, string]> = {
  connect: [
    "Connect your WhatsApp number",
    "Link the number patients already message.",
  ],
  flow: [
    "Design the booking conversation",
    "Start from a template, then make it yours.",
  ],
  content: [
    "Add doctor and department files",
    "Optional photos and PDFs patients receive.",
  ],
  test: ["Booking availability", "Book a real appointment by messaging your connected number."],
};

function Setup({ clinic }: { clinic: Clinic }) {
  const { can } = useWorkspace();
  const remote = useManagedSetup();
  const { setup, update } = remote;
  const stage = currentStage(setup);
  const [open, setOpen] = useState<Stage>(stage);
  const [workspace, setWorkspace] = useState(true);
  useEffect(() => {
    setOpen(currentStage(setup));
  }, [setup.connected?.phone]);
  const [editing, setEditing] = useState<Stage | null>(null);
  const canManage = can("comms.manage");
  const reached = stageOrder.indexOf(stage);
  const advance = (patch: Partial<WhatsAppSetup>) => {
    const next = { ...setup, ...patch };
    update(patch);
    setOpen(currentStage(next));
    setEditing(null);
  };
  const preview = (
    <div className="xl:sticky xl:top-6">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        What patients see
      </p>
      <PhonePreview clinic={clinic} setup={setup} />
    </div>
  );
  const body = (s: Stage) =>
    s === "connect" ? (
      <ConnectStep
        clinic={clinic}
        setup={setup}
        update={update}
        done={advance}
        available={!!remote.query.data?.available}
      />
    ) : s === "flow" ? (
      <FlowEditor
        clinic={clinic}
        setup={setup}
        update={update}
        done={advance}
      />
    ) : s === "content" ? (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Files for automated booking are not available yet.
        </p>
        <Button onClick={() => advance({ contentDone: true })}>
          Continue without files
        </Button>
      </div>
    ) : (
      <TestStep setup={setup} update={update} done={advance} />
    );
  const preflight = (
    <Badge variant="outline" className="font-normal">
      {remote.saving
        ? "Saving…"
        : remote.error
          ? "Not saved"
          : "Saved to your clinic"}
    </Badge>
  );
  if (remote.query.loading) return <p>Loading WhatsApp…</p>;
  if (remote.query.error || remote.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {remote.query.error || remote.error} Reload this page to check saved
        settings.
      </p>
    );
  if (stage === "live" || (workspace && !!setup.connected))
    return (
      <>
        <PageTitle
          title="WhatsApp"
          icon={<WhatsAppIcon className="size-7" />}
          action={preflight}
        />
        {editing ? (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="p-6 shadow-none">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    {titles[editing as Exclude<Stage, "live">][0]}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {titles[editing as Exclude<Stage, "live">][1]}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Done
                </Button>
              </div>
              <fieldset disabled={!canManage}>{body(editing)}</fieldset>
            </Card>
            {preview}
          </div>
        ) : (
          <>
            <Button
              className="mb-4"
              variant="outline"
              onClick={() => setWorkspace(false)}
            >
              Booking setup
            </Button>
            <Live
              clinic={clinic}
              setup={setup}
              update={update}
              edit={setEditing}
            />
          </>
        )}
      </>
    );
  return (
    <>
      <PageTitle
        title="WhatsApp"
        icon={<WhatsAppIcon className="size-7" />}
        action={preflight}
      />
      {setup.connected && (
        <Button className="mb-4" onClick={() => setWorkspace(true)}>
          Open conversations and settings
        </Button>
      )}
      {!remote.query.data?.available && (
        <p className="mb-4 text-sm text-muted-foreground">
          Exora is preparing WhatsApp connections. No technical setup is needed
          from your team.
        </p>
      )}
      <p className="mb-4 text-sm text-muted-foreground">
        Connect your number to manage real conversations. Automatic booking,
        appointment notices and promotions are managed from this workspace.
      </p>
      <div className="mb-6 max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight">
          Connect your clinic WhatsApp
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect securely to manage patient conversations from this dashboard.
          Set up booking messages here, then enable bookings from the overview.
        </p>
        <div
          className="mt-4 flex gap-1.5"
          aria-label={`Step ${reached + 1} of 4`}
        >
          {stageOrder.slice(0, 4).map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i < reached ? "bg-primary" : i === reached ? "bg-primary/40" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>
      {!canManage && (
        <p className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          Your administrator needs to finish WhatsApp setup. You can follow
          progress here.
        </p>
      )}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="space-y-3">
          {(Object.keys(titles) as Exclude<Stage, "live">[]).map((s, i) => {
            const done = i < reached,
              locked = i > reached,
              active = open === s && !locked;
            return (
              <li key={s}>
                <Card
                  className={`gap-0 p-0 shadow-none ${active ? "ring-1 ring-foreground/15" : ""}`}
                >
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setOpen(s)}
                    className="flex w-full items-center gap-4 p-5 text-left disabled:cursor-not-allowed"
                  >
                    <StepDot n={i + 1} done={done} active={active} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium ${locked ? "text-muted-foreground" : ""}`}
                      >
                        {titles[s][0]}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {done && !active
                          ? summary(s, setup, clinic)
                          : titles[s][1]}
                      </p>
                    </div>
                    {locked ? (
                      <Lock className="size-4 text-muted-foreground" />
                    ) : done && !active ? (
                      <span className="text-xs text-muted-foreground">
                        Edit
                      </span>
                    ) : null}
                  </button>
                  {active && (
                    <fieldset disabled={!canManage} className="border-t p-5">
                      {body(s)}
                    </fieldset>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
        {preview}
      </div>
    </>
  );
}

function summary(s: Stage, setup: WhatsAppSetup, clinic: Clinic) {
  if (s === "connect" && setup.connected)
    return `${setup.connected.phone} · ${setup.connected.name} · ${setup.path === "coexistence" ? "Business app kept" : "New number"}`;
  if (s === "flow" && setup.shape)
    return `${shapes[setup.shape].label} · ${setup.steps.filter((x) => x.on).length} steps`;
  if (s === "content")
    return `${Object.keys(setup.content).length} files for ${clinic.doctors.length} doctors`;
  return "";
}

type StepProps = {
  clinic: Clinic;
  setup: WhatsAppSetup;
  update: (patch: Patch) => void;
  done: (patch: Partial<WhatsAppSetup>) => void;
};

const eligibility = [
  "This number runs on the WhatsApp Business app (not personal WhatsApp)",
  "It has been active on the Business app for at least 7 days",
  "The Business app is updated to the latest version",
  "You have the phone with you to scan a QR code",
  "You can log in to Facebook as an admin of the clinic's business",
];
const coexistenceChanges = [
  "Your team keeps using the Business app. New incoming messages appear in Exora.",
  "Past chats and phone contacts are not imported into Exora. App replies stay in the Business app.",
  "Groups and disappearing messages are not supported in the dashboard.",
  "Linked devices (WhatsApp Web) sign out once and need re-linking.",
];

function ConnectStep({
  clinic,
  setup,
  update,
  available,
}: StepProps & { available: boolean }) {
  const [checked, setChecked] = useState<number[]>([]);
  const { facility } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const [phone, setPhone] = useState(setup.connected?.phone ?? "+91");
  const [name, setName] = useState(setup.connected?.name ?? clinic.name);
  const [meta, setMeta] = useState(false);
  const co = setup.path === "coexistence";
  const ready =
    available &&
    validPhone(phone) &&
    name.trim().length > 1 &&
    (!co || checked.length === eligibility.length);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            [
              "coexistence",
              "Keep your current number",
              "Use the number on your WhatsApp Business app. The app keeps working.",
              true,
            ],
            [
              "new_number",
              "Use a new number",
              "A SIM or landline that has never been on WhatsApp.",
              false,
            ],
          ] as const
        ).map(([path, title, text, recommended]) => (
          <button
            key={path}
            type="button"
            onClick={() => update({ path })}
            className={`rounded-lg border p-4 text-left transition-colors ${setup.path === path ? "border-primary bg-muted/50" : "hover:bg-muted/30"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{title}</p>
              {recommended && <Badge variant="secondary">Recommended</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{text}</p>
          </button>
        ))}
      </div>
      {co ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium">Before you start</p>
            <div className="space-y-3">
              {eligibility.map((text, i) => (
                <label key={text} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={checked.includes(i)}
                    onCheckedChange={(on) =>
                      setChecked(
                        on ? [...checked, i] : checked.filter((x) => x !== i),
                      )
                    }
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium">What changes</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {coexistenceChanges.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-3 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          Keep the SIM in a phone nearby. Meta sends a code by SMS or call to
          verify it. Meta will guide you through the options available for this
          number.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wa-phone">WhatsApp number</Label>
          <Input
            id="wa-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            placeholder="+919876543210"
          />
          {phone.length > 4 && !validPhone(phone) && (
            <p className="text-xs text-destructive">
              Use + country code and number, e.g. +919876543210
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="wa-name">Name patients see</Label>
          <Input
            id="wa-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!ready} onClick={() => setMeta(true)}>
          Continue with Facebook <ArrowRight />
        </Button>
        <span className="text-xs text-muted-foreground">
          Opens Meta's secure window. We never see your Facebook password.
        </span>
      </div>
      <Dialog open={meta} onOpenChange={setMeta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect with Meta</DialogTitle>
            <DialogDescription>In Meta's window you will:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-sm">
            {[
              "Log in to Facebook and pick the clinic's business",
              `Confirm ${phone} as the WhatsApp number`,
              co
                ? "Open the Business app on that phone and scan the QR code shown"
                : "Enter the code Meta sends by SMS or call",
              "Allow Exora Health to manage messages for this number",
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <StepDot n={i + 1} done={false} active={false} />
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ol>
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Meta handles sign-in and phone verification. Your connection is
            confirmed only after Meta accepts it.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={connecting}
              onClick={() => setMeta(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={connecting}
              onClick={() => {
                setConnecting(true);
                void connectMeta(facility.facilityId, setup.path)
                  .then(() => location.reload())
                  .catch((e) => toast.error(e.message))
                  .finally(() => setConnecting(false));
              }}
            >
              {connecting ? "Connecting…" : "Connect securely with Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlowEditor({ clinic, setup, update, done }: StepProps) {
  const suggested = suggestShape(
    clinic.doctors.length,
    clinic.departments.length,
  );
  const choose = (shape: ClinicShape) => {
    if (setup.shape === shape) return;
    if (
      setup.shape &&
      !window.confirm("Switching template resets your step text. Continue?")
    )
      return;
    update({
      shape,
      steps: stepsFor(
        shape,
        setup.connected?.name ?? clinic.name,
        clinic.doctors[0]?.name,
      ),
    });
  };
  const setStep = (id: FlowStep["id"], patch: Partial<FlowStep>) =>
    update((old) => ({
      steps: old.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium">Start from a template</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(shapes) as ClinicShape[]).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => choose(shape)}
              className={`rounded-lg border p-4 text-left transition-colors ${setup.shape === shape ? "border-primary bg-muted/50" : "hover:bg-muted/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{shapes[shape].label}</p>
                {shape === suggested && (
                  <Badge variant="secondary">Fits your clinic</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {shapes[shape].description}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {shapes[shape].steps.map((s) => stepInfo[s].title).join(" → ")}
              </p>
            </button>
          ))}
        </div>
      </div>
      {setup.shape && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-medium">Conversation steps</p>
            {setup.steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-lg border p-4 ${step.on ? "" : "bg-muted/30"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`text-sm font-medium ${step.on ? "" : "text-muted-foreground"}`}
                  >
                    {stepInfo[step.id].title}
                  </p>
                  {stepInfo[step.id].required ? (
                    <span className="text-xs text-muted-foreground">
                      Always on
                    </span>
                  ) : (
                    <Switch
                      checked={step.on}
                      aria-label={`Include ${stepInfo[step.id].title}`}
                      onCheckedChange={(on) => setStep(step.id, { on })}
                    />
                  )}
                </div>
                {step.on && (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      rows={2}
                      maxLength={1024}
                      aria-label={`${stepInfo[step.id].title} message`}
                      value={step.message}
                      onChange={(e) =>
                        setStep(step.id, { message: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Flow attachments are not available yet.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button
            disabled={setup.steps.some((s) => s.on && !s.message.trim())}
            onClick={() => done({ flowDone: true })}
          >
            Save booking flow <ArrowRight />
          </Button>
        </>
      )}
    </div>
  );
}

function TestStep({ setup, update, done }: Omit<StepProps, "clinic">) {
  const link = setup.connected ? chatLink(setup.connected.phone) : "";
  return (
    <div className="space-y-5">
      <ol className="space-y-5">
        <li className="flex gap-4">
          <StepDot n={1} done={setup.tested} active={!setup.tested} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">
              From a different phone, send “Hi” to {setup.connected?.phone}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(link)
                    .then(() => toast.success("Chat link copied"))
                    .catch(() =>
                      toast.error("Copy failed. Select the link instead."),
                    )
                }
              >
                <Copy /> Copy chat link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={link} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink /> Open
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">{link}</p>
          </div>
        </li>
        <li className="flex gap-4">
          <StepDot n={2} done={setup.tested} active={false} />
          <label className="flex flex-1 items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={setup.tested}
              disabled
              onCheckedChange={(tested) =>
                update({ tested: !!tested, live: tested ? setup.live : false })
              }
            />
            <span>
              <span className="font-medium">Automatic booking test</span>
              <span className="block text-xs text-muted-foreground">
                After enabling bookings, send HI to check the full conversation. Bookings appear in Appointments.
              </span>
            </span>
          </label>
        </li>
        <li className="flex gap-4">
          <StepDot
            n={3}
            done={setup.live}
            active={setup.tested && !setup.live}
          />
          <div className="flex flex-1 items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Accept bookings on WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Book a real appointment by messaging your connected number. Your connected inbox is
                available now.
              </p>
            </div>
            <Switch
              checked={setup.live}
              disabled={!setup.connected}
              aria-label="Accept bookings on WhatsApp"
              onCheckedChange={(live) =>
                live ? done({ live: true }) : update({ live: false })
              }
            />
          </div>
        </li>
      </ol>
    </div>
  );
}

function PhonePreview({
  clinic,
  setup,
}: {
  clinic: Clinic;
  setup: WhatsAppSetup;
}) {
  const name = setup.connected?.name ?? clinic.name;
  const steps = setup.shape
    ? setup.steps.filter((s) => s.on)
    : stepsFor(
        suggestShape(clinic.doctors.length, clinic.departments.length),
        name,
        clinic.doctors[0]?.name,
      ).filter((s) => s.on);
  const doctor = clinic.doctors[0];
  const department =
    clinic.departments[0]?.name ?? doctor?.department ?? "General medicine";
  const reply = (id: FlowStep["id"]) =>
    id === "department"
      ? department
      : id === "doctor"
        ? (doctor?.name ?? "")
        : stepInfo[id].patient;
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-foreground/85 bg-[#efeae2] shadow-sm">
      <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
        <div className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-semibold">
          {name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-[11px] opacity-80">Business account</p>
        </div>
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto p-3 text-[13px] leading-snug text-[#111b21]">
        <Bubble me>Hi</Bubble>
        {steps.map((s) => (
          <div key={s.id} className="space-y-2">
            <Bubble>
              {s.header && (
                <HeaderPreview id={`step:${s.id}`} header={s.header} />
              )}
              <p className="whitespace-pre-wrap">{s.message}</p>
              {s.id === "welcome" && (
                <Choices items={["Book appointment", "My visits"]} />
              )}
              {s.id === "department" && (
                <Choices
                  items={clinic.departments
                    .slice(0, 3)
                    .map((d) => d.name)
                    .concat(clinic.departments.length > 3 ? ["More…"] : [])}
                />
              )}
              {s.id === "doctor" && (
                <Choices
                  items={clinic.doctors.slice(0, 3).map((d) => {
                    const fee = clinic.fee(d.staffId);
                    return `${d.name}${fee !== null ? ` · ₹${fee}` : ""}`;
                  })}
                />
              )}
              {s.id === "slot" && (
                <Choices
                  items={[
                    "Tomorrow, 10:30 am",
                    "Tomorrow, 11:00 am",
                    "Other days",
                  ]}
                />
              )}
              {s.id === "confirm" && (
                <div className="mt-2 rounded-md bg-[#f0f2f5] p-2 text-xs">
                  <p className="font-medium">{doctor?.name}</p>
                  <p>Tomorrow, 10:30 am · Ref EX-4821</p>
                </div>
              )}
            </Bubble>
            {s.id !== "confirm" && s.id !== "welcome" && reply(s.id) && (
              <Bubble me>{reply(s.id)}</Bubble>
            )}
            {s.id === "welcome" && <Bubble me>Book appointment</Bubble>}
            {s.id === "department" &&
              clinic.departments[0] &&
              setup.content[`guide:${clinic.departments[0].id}`] && (
                <Bubble>
                  <HeaderPreview
                    id={`guide:${clinic.departments[0].id}`}
                    header={setup.content[`guide:${clinic.departments[0].id}`]}
                  />
                </Bubble>
              )}
            {s.id === "doctor" &&
              doctor &&
              setup.content[`photo:${doctor.staffId}`] && (
                <Bubble>
                  <HeaderPreview
                    id={`photo:${doctor.staffId}`}
                    header={setup.content[`photo:${doctor.staffId}`]}
                  />
                </Bubble>
              )}
            {s.id === "doctor" &&
              doctor &&
              setup.content[`profile:${doctor.staffId}`] && (
                <Bubble>
                  <HeaderPreview
                    id={`profile:${doctor.staffId}`}
                    header={setup.content[`profile:${doctor.staffId}`]}
                  />
                </Bubble>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
