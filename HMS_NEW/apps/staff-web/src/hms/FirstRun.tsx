import colourStyles from "./overview-colours.module.css";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand-icons";
// First-run guide (docs/prd/first-run-onboarding.md): setup home, ready home, welcome slides, coach marks.
import { useEffect, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowRight, CalendarPlus, CircleCheck, Headphones, Lock, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/workspace";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { StepList } from "./StepList";
import { useWorkspace } from "./hooks";
import { useAlerts } from "./use-alerts";
import { useReadyChannels } from "./channel-ready";
import { SETUP_STEPS, guideStep, setupProgress } from "./first-run";

const withGuide = (destination: string, id: string) =>
  `${destination}${destination.includes("?") ? "&" : "?"}guide=${id}`;

const CHANNELS = [
  { key: "whatsapp", title: "WhatsApp", next: "Connect WhatsApp", hint: "Bookings and reminders on WhatsApp." },
  { key: "google_business", title: "Google Business", next: "Set up Google Business", hint: "Get found on Google Search and Maps." },
  { key: "voice", title: "Voice agent", next: "Set up your voice agent", hint: "Answer calls and book appointments." },
  { key: "apple_messages", title: "Apple Messages", next: "Set up Apple Messages", hint: "Let patients message you from iPhone." },
];

const channelIcons: Record<string, ReactNode> = {
  book: <CalendarPlus aria-hidden="true" />,
  whatsapp: <WhatsAppIcon />,
  google_business: <GoogleIcon />,
  voice: <Headphones aria-hidden="true" />,
  apple_messages: <MessageCircle aria-hidden="true" />,
};

/** Overview while booking setup is unfinished: the four steps and nothing else. */
export function SetupHome() {
  const { facility, can, go } = useWorkspace();
  const { setup } = useAlerts();
  const progress = setupProgress(setup.items);
  const known = progress && progress !== "loading" ? progress : null;
  const reached = known?.reached ?? 0;
  const isDone = (id: string) => !!known?.done.has(id);
  const [picked, setPicked] = useState<string | null>(null);
  const open = picked && SETUP_STEPS.findIndex((s) => s.id === picked) <= reached ? picked : SETUP_STEPS[reached]?.id ?? "";
  const item = (id: string) => setup.items.find((i) => i.id === id);
  const summary: Record<string, string | undefined> = {
    clinic: facility.name,
    doctor: setup.doctor?.name,
    service: "Fee added",
    hours: "Hours published",
  };
  return (
    <>
      <PageTitle
        title={`Set up ${facility.name}`}
        action={
          <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new Event("pw-welcome"))}>
            Show welcome
          </Button>
        }
      />
      <p className="-mt-4 mb-4 text-sm text-muted-foreground">
        {known?.done.size ?? 0} of {SETUP_STEPS.length} done · about 10 minutes
      </p>
      <div className="mb-6 flex max-w-xl gap-1.5" aria-hidden="true">
        {SETUP_STEPS.map((s, i) => (
          <span key={s.id} className={`h-1.5 flex-1 rounded-full ${isDone(s.id) ? "bg-guide-done" : i === reached ? "bg-guide-now" : "bg-muted"}`} />
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <StepList
            steps={SETUP_STEPS.map((s) => ({ id: s.id, title: s.title, hint: s.hint, summary: summary[s.id], done: isDone(s.id) }))}
            reached={reached}
            open={open}
            onOpen={setPicked}
            canManage
            body={(id) => {
              const step = SETUP_STEPS.find((s) => s.id === id)!;
              const i = item(id);
              const done = isDone(id);
              if (i && !can(i.permission)) return <p className="text-sm text-muted-foreground">Ask your administrator to finish this step.</p>;
              return (
                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    className={done ? undefined : "guide-cta"}
                    variant={done ? "outline" : "default"}
                    onClick={() => go(withGuide(i?.destination ?? "overview", id))}
                  >
                    {done ? "Review" : step.action}
                    {!done && <ArrowRight className="size-4" />}
                  </Button>
                  {!done && <span className="text-xs text-muted-foreground">We'll point to what to click.</span>}
                </div>
              );
            }}
          />
        </div>
        <Card className={`gap-0 p-0 shadow-none ${colourStyles.reachCard}`}>
          <div className={`border-b p-5 ${colourStyles.reachHeader}`}>
            <p className="text-sm font-medium text-phase-reach">Up next: reach patients</p>
            <p className="text-sm text-muted-foreground">Opens once setup is done.</p>
          </div>
          <ul className="divide-y">
            {CHANNELS.map((c) => (
              <li key={c.key} className="flex items-center gap-3 p-4">
                <span className={`${colourStyles.iconChip} ${colourStyles[c.key]}`}>{channelIcons[c.key]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </div>
                <Lock className="size-4 text-muted-foreground" aria-label="Locked" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

/** Overview once setup is done but before the first appointment: what to do next, no all-zero tiles. */
export function ReadyHome() {
  const { facility, can, go } = useWorkspace();
  const admin = useAlerts().setup.admin;
  const channels = CHANNELS.filter((c) => can(c.key === "voice" ? "voice.read" : c.key === "google_business" ? "growth.read" : "comms.read"));
  const ready = useReadyChannels(admin ? facility.facilityId : "", channels.map((c) => c.key), "overview");
  const book = can("appointments.book");
  if (!admin)
    return (
      <>
        <PageTitle title="Overview" />
        <Card className="items-start gap-3 p-6 shadow-none">
          <p className="font-medium">Nothing to report yet</p>
          <p className="text-sm text-muted-foreground">Activity shows here after the first booking.</p>
          {book && <Button onClick={() => go("appointments?book=1")}>Book appointment</Button>}
        </Card>
      </>
    );
  return (
    <div className={colourStyles.overview}>
      <div className={colourStyles.readyBanner}>
      <PageTitle
        title={`${facility.name} is ready for bookings`}
        icon={<CircleCheck className="size-6 text-guide-done" aria-hidden="true" />}
      />
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">Get your first patients.</p>
      </div>
      <ol className="max-w-3xl space-y-3">
        {[
          ...(book ? [{ key: "book", title: "Book your first appointment", hint: "Try it with a test patient.", action: "Book appointment", to: "appointments?book=1", done: false }] : []),
          ...channels.map((c) => ({ key: c.key, title: c.next, hint: c.hint, action: "Set up", to: c.key, done: ready.has(c.key) })),
        ].map((s, n) => (
          <li key={s.key}>
            <Card className={`flex-row items-center gap-4 p-5 shadow-none ${s.key === "book" ? colourStyles.bookingCard : ""}`}>
              <span
                className={`${colourStyles.iconChip} ${colourStyles[s.key]} ${s.done ? colourStyles.connected : ""}`}
              >
                {s.done ? <CircleCheck className="size-4" aria-label="Done" /> : channelIcons[s.key]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.done ? "Connected" : s.hint}</p>
              </div>
              <Button
                variant={n === 0 && !s.done ? "default" : "outline"}
                className={n === 0 && !s.done ? "guide-cta" : undefined}
                onClick={() => go(s.to)}
              >
                {s.done ? "Open" : s.action}
              </Button>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SLIDES = (clinic: string) => [
  { title: "Welcome to Paperwhale", body: `Let's get ${clinic} ready to take bookings.` },
  { title: "Four steps, about 10 minutes", body: "Clinic details, a doctor, a consultation fee and opening hours." },
  { title: "Then reach patients", body: "Once you're set up, connect WhatsApp, Google and your phone line." },
];

/** One-time welcome for admins of a clinic that isn't set up. "Seen" lives in this browser only. */
export function WelcomeSlides() {
  const { me, facility } = useWorkspace();
  const { setup } = useAlerts();
  const progress = setupProgress(setup.items);
  const key = `pw-welcome:${me.tenantId}:${me.staffId}`;
  const seen = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const due = !!progress && progress !== "loading" && !progress.ready;
  useEffect(() => {
    if (due && !seen()) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, key]);
  useEffect(() => {
    const replay = () => {
      setN(0);
      setOpen(true);
    };
    window.addEventListener("pw-welcome", replay);
    return () => window.removeEventListener("pw-welcome", replay);
  }, []);
  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode: the welcome may show again */
    }
    setOpen(false);
    setN(0);
  };
  const slides = SLIDES(facility.name);
  const last = n === slides.length - 1;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent title={slides[n]!.title} description={slides[n]!.body} className="welcome-slides">
        <div className="mt-8 flex items-center gap-4">
          <div className="flex flex-1 gap-2" aria-label={`Slide ${n + 1} of ${slides.length}`} role="img">
            {slides.map((s, i) => (
              <span key={s.title} className={`size-2 rounded-full bg-white ${i === n ? "" : "opacity-40"}`} />
            ))}
          </div>
          {!last && (
            <button type="button" className="px-3 py-2 text-sm font-medium text-white" onClick={close}>
              Skip
            </button>
          )}
          <Button className="welcome-next h-11 px-6" onClick={() => (last ? close() : setN(n + 1))}>
            {last ? "Start setup" : "Next"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Finds the visible, enabled button the current guide step points at, unless a dialog covers the page. */
function findTarget(label: string): HTMLElement | null {
  if (document.querySelector('[role="dialog"]:not(.coach-bubble)')) return null;
  for (const b of document.querySelectorAll<HTMLElement>("main button, main a")) {
    if (b.textContent?.trim() === label && b.offsetParent && !(b as HTMLButtonElement).disabled) return b;
  }
  return null;
}

/**
 * Dark coach bubble for `?guide=<step>`: points at the button to press, then says when the saved data
 * completes the step. It never claims success on its own; completion comes from the setup reads.
 */
export function CoachMark({ search }: { search: string }) {
  const { go } = useWorkspace();
  const { setup } = useAlerts();
  const step = guideStep(search);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [dismissed, setDismissed] = useState("");
  const n = step ? SETUP_STEPS.indexOf(step) : -1;
  const done = !!step && setup.items.find((i) => i.id === step.id)?.state === "complete";
  const active = !!step && dismissed !== search;
  useEffect(() => {
    if (!active || done) {
      setTarget(null);
      return;
    }
    // ponytail: polls every 300ms while a guide step is open; switch to a MutationObserver if pages get heavy.
    const tick = () => setTarget((old) => {
      const next = findTarget(step.target);
      return next === old ? old : next;
    });
    tick();
    const timer = setInterval(tick, 300);
    return () => clearInterval(timer);
  }, [active, done, step]);
  useEffect(() => {
    if (!target) return;
    const { outline, outlineOffset } = target.style;
    target.style.outline = "2px solid var(--guide-now)";
    target.style.outlineOffset = "3px";
    return () => {
      target.style.outline = outline;
      target.style.outlineOffset = outlineOffset;
    };
  }, [target]);
  if (!active || !step) return null;
  const dismiss = () => setDismissed(search);
  const header = (
    <div className="mb-2 flex items-center justify-between gap-4 text-xs text-white/70">
      <span>Step {n + 1} of {SETUP_STEPS.length}</span>
      <button type="button" aria-label="Close guide" className="text-white/70 hover:text-white" onClick={dismiss}>
        <X className="size-4" />
      </button>
    </div>
  );
  if (done) {
    const progress = setupProgress(setup.items);
    const next = progress && progress !== "loading" && !progress.ready ? SETUP_STEPS[progress.reached] : null;
    return (
      <div role="status" className="coach-bubble fixed right-6 bottom-6 z-50 w-80">
        {header}
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck className="size-4 text-guide-done" /> {step.title} done
        </p>
        <button type="button" className="mt-3 flex items-center gap-1 text-sm font-semibold underline" onClick={() => go("overview")}>
          {next ? `Next: ${next.title}` : "You're ready for bookings"} <ArrowRight className="size-4" />
        </button>
      </div>
    );
  }
  if (!target) return null;
  return (
    <Popover.Root open>
      <Popover.Anchor virtualRef={{ current: target }} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className="coach-bubble z-50 w-80"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={dismiss}
        >
          {header}
          <p className="text-sm leading-relaxed">{step.hint}</p>
          <p className="mt-3 text-sm font-semibold">Next: click "{step.target}".</p>
          <Popover.Arrow className="fill-[var(--coach-bg)]" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Shown in place of a page that needs booking setup first. */
export function LockedPage({ name }: { name: string }) {
  const { go } = useWorkspace();
  return (
    <>
      <PageTitle title={name} />
      <Card className="items-start gap-3 p-6 shadow-none">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> Finish setup first
        </p>
        <p className="text-sm text-muted-foreground">{name} opens once your clinic is ready for bookings.</p>
        <Button className="guide-cta" onClick={() => go("overview")}>
          Continue setup <ArrowRight className="size-4" />
        </Button>
      </Card>
    </>
  );
}

/** Reports whether booking setup is known to be unfinished, for the sidebar locks above the providers. */
export function SetupWatch({ onChange }: { onChange: (locked: boolean) => void }) {
  const progress = setupProgress(useAlerts().setup.items);
  const locked = !!progress && progress !== "loading" && !progress.ready;
  useEffect(() => onChange(locked), [locked, onChange]);
  return null;
}
