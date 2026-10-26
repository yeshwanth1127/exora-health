import { useWorkspaceTab } from "./use-workspace-tab";
import { workspaceTabs } from "./workspace-navigation";
import { GrowthConfirm } from "./GrowthConfirm";
import { useConfirmationReview } from "./use-confirmation-review";
import { sameReviewedValue } from "./growth-confirmation";
import { GrowthMetric } from "./GrowthMetric";

import type { ReactNode } from "react";
import { toast } from "@/components/toast-events";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Pencil,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/brand-icons";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SharedField } from "@/components/shared-field";
import { TimeField } from "@/components/WorkspaceFields";
import { GrowthSwitch as Switch } from "./GrowthControls";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/arc/tabs/tabs";
import { Textarea } from "@/components/ui/textarea";
import { request } from "./client";
import { useWorkspace } from "./hooks";
import { today } from "./model";
import { shapes, type Stage, type WhatsAppSetup } from "./whatsapp-setup";
import {
  automationInfo,
  needsReply,
  templateState,
  type WaData,
  type WaSettings,
} from "./whatsapp-data";
import {
  ago,
  startOfToday,
  statusLabels,
  Ticks,
  useNow,
  useWaData,
  type Change,
  type Clinic,
} from "./whatsapp-ui";
import {
  ManagedAutomations,
  ManagedPromotions,
} from "./WhatsAppManagedOperations";
import { Inbox } from "./WhatsAppInbox";
import { Activity } from "./WhatsAppActivity";
import type { Patch } from "./WhatsApp";

const tabs = workspaceTabs.whatsapp;
type Tab = (typeof tabs)[number][0];

export function Live({
  clinic,
  setup,
  update,
  edit,
}: {
  clinic: Clinic;
  setup: WhatsAppSetup;
  update: (patch: Patch) => void;
  edit: (s: Stage) => void;
}) {
  const { facility, can } = useWorkspace();
  const name = setup.connected?.name ?? clinic.name;
  const [data, change] = useWaData(
    `exora:whatsapp:${facility.facilityId}`,
    () => ({
      v: 1,
      day: today(facility.timezone),
      conversations: [],
      automations: [],
      campaigns: [],
      log: [],
      optedIn: 0,
      settings: {
        quiet: { on: true, from: "21:00", to: "08:00" },
        hours: { from: "09:00", to: "18:00" },
        away: { on: false, text: "" },
        handoffWords: "human, receptionist",
        savedReplies: [],
        askConsent: false,
      },
    }),
  );
  const [tab, navigateTab] = useWorkspaceTab("whatsapp");
  const open = (tab: Tab, extra = "") =>
    navigateTab(
      tab,
      Object.fromEntries(new URLSearchParams(extra.replace(/^&/, ""))),
    );
  const waiting = data.conversations.filter(needsReply).length;
  const canManage = can("comms.manage");
  return (
    <div className="space-y-6">
      {data.loading && <p>Loading conversations…</p>}
      {data.error && (
        <p role="alert" className="text-sm text-destructive">
          {data.error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {data.capabilities?.sending
          ? "Replies are sent from this inbox. Delivery is shown only after Meta confirms it."
          : "Sending is not available yet."}{" "}
        Booking and appointment notices follow the clinic’s saved settings.
      </p>
      <Tabs
        value={tab}
        onValueChange={(v) => open(v as Tab)}
        className="arc-workflow-root"
      >
        <div className="arc-demo-scope">
          <TabsList aria-label="WhatsApp workspace">
            {tabs.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                <span className="inline-flex items-center gap-2">
                  {label}
                  {k === "inbox" && waiting > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#25d366] px-1 text-[10px] font-semibold text-white">
                      {waiting}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="arc-workflow-panel">
          <Overview
            data={data}
            change={change}
            setup={setup}
            update={update}
            open={open}
            canManage={canManage}
          />
        </TabsContent>
        <TabsContent value="inbox" className="arc-workflow-panel">
          <Inbox
            data={data}
            change={change}
            clinicName={name}
            openAutomations={() => open("automations", "&id=staff_reply")}
          />
        </TabsContent>
        <TabsContent value="automations" className="arc-workflow-panel">
          <ManagedAutomations />
        </TabsContent>
        <TabsContent value="promotions" className="arc-workflow-panel">
          <ManagedPromotions />
        </TabsContent>
        <TabsContent value="log" className="arc-workflow-panel">
          <Activity data={data} change={change} />
        </TabsContent>
        <TabsContent value="settings" className="arc-workflow-panel">
          <SettingsTab
            data={data}
            change={change}
            clinic={clinic}
            setup={setup}
            update={update}
            edit={edit}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusCard({
  setup,
  update,
  active,
  ready,
}: {
  setup: WhatsAppSetup;
  update: (p: Patch) => void;
  canManage: boolean;
  active: boolean;
  ready: boolean;
}) {
  const { can } = useWorkspace();
  const paused = !active;
  return (
    <Card className="flex-row flex-wrap items-center justify-between gap-4 p-5 shadow-none">
      <div className="flex items-center gap-4">
        <div className="grid size-11 place-items-center rounded-full bg-[#25d366]/15">
          <WhatsAppIcon className="size-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{setup.connected?.name}</p>
            <Badge variant="outline" className="gap-1.5">
              <span
                className={`size-1.5 rounded-full ${paused ? "bg-amber-500" : "bg-emerald-600"}`}
              />
              {paused ? "Connected · booking paused" : "Taking bookings"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {setup.connected?.phone} ·{" "}
            {setup.path === "coexistence"
              ? "Business app kept on this number"
              : "Dedicated number"}
          </p>
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        {paused
          ? "Booking paused. Reception can still reply."
          : "Accepting bookings"}
        <Switch
          checked={!paused}
          disabled={!can("comms.manage") || !ready}
          aria-label="Accept bookings on WhatsApp"
          onCheckedChange={(on) => update({ live: on, paused: !on })}
        />
      </label>
    </Card>
  );
}

function Overview({
  data,
  setup,
  update,
  open,
  canManage,
}: {
  data: WaData;
  change: Change;
  setup: WhatsAppSetup;
  update: (p: Patch) => void;
  open: (t: Tab, extra?: string) => void;
  canManage: boolean;
}) {
  const now = useNow();
  const todayLog = data.log.filter((e) => e.at >= startOfToday(now));
  const out = todayLog.filter((e) => e.direction === "out");
  const settled = out.filter((e) =>
    ["delivered", "read", "failed"].includes(e.status),
  );
  const delivered = settled.filter(
    (e) => e.status === "delivered" || e.status === "read",
  ).length;
  const failed =
    data.messageStats?.failed ??
    out.filter((e) => e.status === "failed").length;
  const waiting = data.conversations.filter(needsReply).length;
  const waitingApproval = data.automations.filter(
    (a) => a.on && !a.approved,
  ).length;
  const rejected = data.automations.filter(
    (a) => templateState(a) === "rejected",
  ).length;
  const offAfterVisit = data.automations.filter(
    (a) => automationInfo[a.id].stage === "after" && !a.on,
  ).length;
  const attention: [string, string, () => void, boolean][] = [
    [
      `${waiting} patient${waiting === 1 ? " is" : "s are"} waiting for a reply`,
      "Open inbox",
      () => open("inbox"),
      waiting > 0,
    ],
    [
      `${failed} message${failed === 1 ? "" : "s"} failed today`,
      "See why",
      () => open("log", "&status=failed"),
      failed > 0,
    ],
    [
      `${waitingApproval} automation${waitingApproval === 1 ? " is" : "s are"} on but waiting for Meta approval`,
      "Review",
      () => open("automations"),
      waitingApproval > 0,
    ],
    [
      `${rejected} template${rejected === 1 ? " was" : "s were"} rejected by Meta`,
      "Fix",
      () => open("automations"),
      rejected > 0,
    ],
    [
      `${offAfterVisit} after-visit message${offAfterVisit === 1 ? " is" : "s are"} off. Missed-visit and feedback messages bring patients back.`,
      "Set up",
      () => open("automations", "&id=no_show"),
      offAfterVisit > 0,
    ],
  ];
  const todo = attention.filter((a) => a[3]);
  return (
    <div className="space-y-6">
      <StatusCard
        setup={setup}
        update={update}
        canManage={canManage}
        active={!!data.bookingActive}
        ready={!!data.capabilities?.booking && !data.busy}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Today on WhatsApp</h2>
        <Button variant="outline" onClick={() => open("inbox")}>
          Open inbox · {waiting} waiting for reply
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <GrowthMetric
          label="Booked on WhatsApp today"
          value={data.bookedToday ?? null}
          context="Recorded bookings today"
        />
        <GrowthMetric
          label="Messages accepted today"
          value={
            data.messageStats?.sent ??
            out.filter((e) => ["sent", "delivered", "read"].includes(e.status))
              .length
          }
          context="Accepted outbound messages; not delivery receipts"
        />
        <GrowthMetric
          label="Delivered"
          value={
            (data.messageStats?.settled ?? settled.length)
              ? Math.round(
                  ((data.messageStats?.delivered ?? delivered) /
                    (data.messageStats?.settled ?? settled.length)) *
                    100,
                )
              : null
          }
          suffix="%"
          context="Of settled outbound messages"
        />
        <GrowthMetric
          label="Waiting for reply"
          value={waiting}
          context="Conversations needing staff"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="gap-0 p-0 shadow-none">
          <h2 className="border-b px-5 py-3 text-sm font-semibold">
            Needs attention
          </h2>
          {todo.length ? (
            <ul className="divide-y">
              {todo.map(([text, action, go]) => (
                <li
                  key={text}
                  className="flex items-center gap-3 px-5 py-3 text-sm"
                >
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <span className="flex-1">{text}</span>
                  <Button size="sm" variant="outline" onClick={go}>
                    {action}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" /> All clear.
              Nothing needs you right now.
            </p>
          )}
        </Card>
        <Card className="gap-0 p-0 shadow-none">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">
              Latest messages · up to 100
            </h2>
            <Button size="xs" variant="ghost" onClick={() => open("log")}>
              Message log <ArrowRight />
            </Button>
          </div>
          <ul className="divide-y">
            {data.log.slice(0, 6).map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 px-5 py-2.5 text-sm"
              >
                <span className="w-10 shrink-0 text-xs text-muted-foreground">
                  {ago(e.at, now)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {e.direction === "in" ? "From " : "To "}
                  {e.patient}{" "}
                  <span className="text-muted-foreground">· {e.kind}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Ticks status={e.status} /> {statusLabels[e.status]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="gap-0 p-0 shadow-none">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Appointment lifecycle</h2>
          <Button size="xs" variant="ghost" onClick={() => open("automations")}>
            Automations <ArrowRight />
          </Button>
        </div>
        <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {data.automations
            .filter((a) => a.id !== "staff_reply")
            .map((a) => {
              const info = automationInfo[a.id];
              const live = a.on && !!a.approved;
              return (
                <li key={a.id} className="bg-card">
                  <button
                    type="button"
                    onClick={() => open("automations", `&id=${a.id}`)}
                    className="w-full px-5 py-3 text-left hover:bg-muted/40"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={`size-1.5 rounded-full ${live ? "bg-emerald-600" : a.on ? "bg-amber-500" : "bg-muted-foreground/40"}`}
                      />
                      {info.title}
                    </p>
                    <p className="pl-3.5 text-xs text-muted-foreground">
                      {live
                        ? info.timings.find(([k]) => k === a.timing)?.[1]
                        : a.on
                          ? "Waiting for Meta approval"
                          : "Off"}
                    </p>
                  </button>
                </li>
              );
            })}
        </ol>
      </Card>
    </div>
  );
}

function SettingsTab({
  data,
  change,
  clinic,
  setup,
  edit,
  canManage,
}: {
  data: WaData;
  change: Change;
  clinic: Clinic;
  setup: WhatsAppSetup;
  update: (p: Patch) => void;
  edit: (s: Stage) => void;
  canManage: boolean;
}) {
  const disconnection = useConfirmationReview<WhatsAppSetup>();
  const { facility } = useWorkspace();

  const s = data.settings;
  const set = (patch: Partial<WaSettings>) =>
    change((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const files = Object.keys(setup.content).length;
  return (
    <fieldset disabled={!canManage} className="max-w-4xl space-y-6">
      {!canManage && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          Only administrators can change WhatsApp settings.
        </p>
      )}
      <Section
        title="Number and Meta account"
        text="Meta reviews your messages. High quality keeps your sending limit rising."
      >
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Number", setup.connected?.phone],
              ["Name patients see", setup.connected?.name],
              [
                "Connection",
                setup.path === "coexistence"
                  ? "Business app kept on this number"
                  : "Dedicated number",
              ],
              ["Quality rating", "Unavailable"],
              ["Messaging limit", "Unavailable"],
              ["Business verification", "Managed by Meta"],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => edit("connect")}>
            Change number
          </Button>
        </div>
      </Section>
      <Section
        title="Booking setup"
        text="What patients see when they message to book."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "flow",
                CalendarClock,
                "Booking flow",
                setup.shape
                  ? `${shapes[setup.shape].label} · ${setup.steps.filter((x) => x.on).length} steps`
                  : "",
              ],
              [
                "content",
                FileText,
                "Doctor and speciality files",
                `${files} file${files === 1 ? "" : "s"} · ${clinic.doctors.length} doctors`,
              ],
            ] as const
          ).map(([stage, Icon, title, text]) => (
            <div
              key={stage}
              className="flex items-center gap-3 rounded-lg border p-4"
            >
              <Icon className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{text}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => edit(stage)}>
                <Pencil /> Edit
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Reception and handover"
        text="When the bot hands a chat to your team, and what patients hear outside these hours."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="wa-open" label="Reception opens">
            <TimeField
              id="wa-open"
              label="Reception opens"
              value={s.hours.from}
              onValueChange={(value) =>
                set({ hours: { ...s.hours, from: value } })
              }
            />
          </Field>
          <Field id="wa-close" label="Reception closes">
            <TimeField
              id="wa-close"
              label="Reception closes"
              value={s.hours.to}
              onValueChange={(value) =>
                set({ hours: { ...s.hours, to: value } })
              }
            />
          </Field>
          <Field id="wa-words" label="Words that reach staff">
            <Input
              id="wa-words"
              value={s.handoffWords}
              onChange={(e) => set({ handoffWords: e.target.value })}
            />
          </Field>
        </div>
        <label className="mt-5 flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Away reply</span>
            <span className="block text-xs text-muted-foreground">
              Included in the opening booking reply outside reception hours.
            </span>
          </span>
          <Switch
            checked={s.away.on}
            aria-label="Away reply"
            onCheckedChange={(on) => set({ away: { ...s.away, on } })}
          />
        </label>
        {s.away.on && (
          <Textarea
            className="mt-3"
            rows={3}
            maxLength={1024}
            aria-label="Away reply text"
            value={s.away.text}
            onChange={(e) => set({ away: { ...s.away, text: e.target.value } })}
          />
        )}
      </Section>
      <Section
        title="Quiet hours"
        text="Appointment notices and promotions wait during quiet hours. Booking replies are never held."
      >
        <label className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">Hold automated messages overnight</span>
          <Switch
            checked={s.quiet.on}
            aria-label="Quiet hours"
            onCheckedChange={(on) => set({ quiet: { ...s.quiet, on } })}
          />
        </label>
        {s.quiet.on && (
          <div className="mt-4 grid max-w-md gap-4 sm:grid-cols-2">
            <Field id="wa-quiet-from" label="From">
              <TimeField
                id="wa-quiet-from"
                label="From"
                value={s.quiet.from}
                onValueChange={(value) =>
                  set({ quiet: { ...s.quiet, from: value } })
                }
              />
            </Field>
            <Field id="wa-quiet-to" label="Until">
              <TimeField
                id="wa-quiet-to"
                label="Until"
                value={s.quiet.to}
                onValueChange={(value) =>
                  set({ quiet: { ...s.quiet, to: value } })
                }
              />
            </Field>
          </div>
        )}
      </Section>
      <Section
        title="Saved replies"
        text="Shown as one-tap replies in the inbox. One per line."
      >
        <Textarea
          rows={4}
          aria-label="Saved replies"
          value={s.savedReplies.join("\n")}
          onChange={(e) => set({ savedReplies: e.target.value.split("\n") })}
          onBlur={() =>
            set({
              savedReplies: s.savedReplies.map((r) => r.trim()).filter(Boolean),
            })
          }
        />
      </Section>
      <Section
        title="Promotions consent"
        text="Promotions only go to patients who said yes."
      >
        <p className="text-sm">
          {data.optedIn} contacts opted in. Record explicit permission from the
          inbox. Anyone can reply STOP to opt out.
        </p>
      </Section>
      <Section
        title="Disconnect"
        text="Stops all WhatsApp booking, reminders and promotions from Paperwhale. Your Business app keeps working."
      >
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => disconnection.request(setup)}
        >
          Disconnect number
        </Button>
      </Section>
      <GrowthConfirm
        open={disconnection.open}
        onDismiss={disconnection.dismiss}
        title="Disconnect WhatsApp?"
        description={`Disconnect ${disconnection.target?.connected?.phone ?? "this number"}? Patients will not be able to book through it until it is connected again.`}
        confirmLabel="Disconnect number"
        blockedReason={
          !canManage
            ? "You no longer have permission to change WhatsApp setup."
            : !sameReviewedValue(setup, disconnection.target)
              ? "The WhatsApp setup changed. Close this dialog and review it before disconnecting."
              : undefined
        }
        onConfirm={() => {
          if (!canManage || !sameReviewedValue(setup, disconnection.target))
            return;
          void request(
            `/v1/managed-connections/whatsapp?facilityId=${facility.facilityId}`,
            { method: "DELETE", idempotencyKey: crypto.randomUUID() },
          )
            .then(() => location.reload())
            .catch((error) => toast.error(error.message));
        }}
      />
    </fieldset>
  );
}

function Section({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 p-5 shadow-none">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{text}</p>
      {children}
    </Card>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <SharedField id={id} label={label}>
      {children}
    </SharedField>
  );
}
