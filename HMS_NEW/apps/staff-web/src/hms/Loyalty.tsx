import { GrowthMetric } from "./GrowthMetric";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Gift,
  Search,
  Sparkles,
  Undo2,
  UserPlus,
} from "lucide-react";
import { toast } from "@/components/toast-events";
import { PageTitle } from "@/components/workspace";
import { WhatsAppIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as Panel } from "@/components/ui/card";
import { GrowthCheckbox as Checkbox } from "./GrowthControls";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { useWorkspace } from "./hooks";
import { Pick } from "./whatsapp-ui";
import { preview } from "./WebsiteAnalyticsSetup";
import { Card, colors, Editor, KindIcon, newProgram } from "./LoyaltyEditor";
import {
  addMonths,
  chip,
  day,
  DAY,
  empty,
  kinds,
  lower,
  memberNo,
  mobile,
  renewUntil,
  sameDay,
  seed,
  standing,
  status,
  summary,
  templates,
  uid,
  visit,
  type Entry,
  type Kind,
  type LoyaltyData,
  type Member,
  type Program,
} from "./loyalty-program";

type Change = (fn: (d: LoyaltyData) => LoyaltyData) => void;

export function Loyalty() {
  const { facility } = useWorkspace();
  return <LoyaltyPage key={facility.facilityId} />;
}

// ponytail: UI-first phase keeps programs and members in this browser; the backend phase reads /v1/loyalty.
function useLoyalty(key: string) {
  const [data, set] = useState<LoyaltyData>(() => {
    try {
      const old = JSON.parse(
        localStorage.getItem(key) ?? "null",
      ) as LoyaltyData | null;
      return old?.v === 1 ? old : empty();
    } catch {
      return empty();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* Private mode: changes last for this visit. */
    }
  }, [key, data]);
  return [data, set] as const;
}

const tabs = [
  ["programs", "Programs"],
  ["members", "Members"],
  ["patient", "Patient view"],
] as const;
type LTab = (typeof tabs)[number][0];
const rewarded: Entry["type"][] = [
  "redeem",
  "stamp_reward",
  "use",
  "referral_done",
  "goal",
];

function LoyaltyPage() {
  const { facility, me, can } = useWorkspace();
  const clinic = facility.name;
  const canEdit = preview && can("growth.manage");
  const canDesk = preview && can("appointments.check_in");
  const [data, change] = useLoyalty(`exora:loyalty:${facility.facilityId}`);
  const [tab, setTab] = useState<LTab>(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return tabs.some(([k]) => k === t) ? (t as LTab) : "programs";
  });
  const [editing, setEditing] = useState<{
    program: Program;
    saved: boolean;
  } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  // Opening the sheet in the same render the dialog closes reads as an outside press and shuts it again.
  const fromDialog = (id: string) => {
    setEnrolling(false);
    setTimeout(() => setMemberId(id));
  };
  const open = (t: LTab) => {
    setTab(t);
    history.replaceState(history.state, "", `?tab=${t}`);
  };
  const now = Date.now();
  const due = data.enrollments.filter(
    (e) => status(e, now) === "expiring",
  ).length;
  const enrolledIn = (id: string) =>
    data.enrollments.filter((e) => e.programId === id && !e.cancelled).length;
  const badge = preview && (
    <Badge variant="outline" className="font-normal">
      UI preview · sample data
    </Badge>
  );

  return (
    <>
      <PageTitle
        title="Loyalty programs"
        icon={<Gift className="size-6" />}
        action={badge}
      />
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => open(v as LTab)} className="arc-workflow-root">
          <div className="arc-demo-scope">
          <TabsList aria-label="Loyalty workspace">
            {tabs.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                <span className="inline-flex items-center gap-2">{label}
                {k === "members" && due > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {due}
                  </span>
                )}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          </div>
        {!preview && (
          <p className="rounded-md border bg-muted/40 p-3 text-sm">
            Loyalty programs open with the next update. You can look around;
            nothing can be set up yet.
          </p>
        )}
        <TabsContent value="programs" className="arc-workflow-panel">
          <Programs
            data={data}
            canEdit={canEdit}
            enrolledIn={enrolledIn}
            onEdit={(p) => setEditing({ program: p, saved: true })}
            onStart={(k) =>
              setEditing({ program: newProgram(k), saved: false })
            }
            onStatus={(id, s) => {
              change((d) => ({
                ...d,
                programs: d.programs.map((p) =>
                  p.id === id ? { ...p, status: s } : p,
                ),
              }));
              toast.success(
                s === "paused"
                  ? "Paused. Members keep what they've earned."
                  : "Program is live",
              );
            }}
            onSample={() => change(() => seed(clinic, Date.now()))}
          />
        </TabsContent>
        <TabsContent value="members" className="arc-workflow-panel">
          <Members
            data={data}
            canDesk={canDesk}
            onOpen={setMemberId}
            onEnrol={() => setEnrolling(true)}
          />
        </TabsContent>
        <TabsContent value="patient" className="arc-workflow-panel"><PatientView data={data} clinic={clinic} /></TabsContent>
        </Tabs>
      </div>
      <Editor
        program={editing?.program ?? null}
        saved={!!editing?.saved}
        clinic={clinic}
        members={editing ? enrolledIn(editing.program.id) : 0}
        canEdit={canEdit}
        onClose={() => setEditing(null)}
        onSave={(p) => {
          change((d) => ({
            ...d,
            programs: d.programs.some((x) => x.id === p.id)
              ? d.programs.map((x) => (x.id === p.id ? p : x))
              : [...d.programs, p],
          }));
          setEditing(null);
          toast.success(p.status === "live" ? `${p.name} is live` : "Saved");
        }}
        onDelete={(id) => {
          change((d) => ({
            ...d,
            programs: d.programs.filter((p) => p.id !== id),
            enrollments: d.enrollments.filter((e) => e.programId !== id),
            entries: d.entries.filter((e) => e.programId !== id),
          }));
          setEditing(null);
          toast.success("Program deleted");
        }}
      />
      <MemberSheet
        data={data}
        change={change}
        memberId={memberId}
        onClose={() => setMemberId(null)}
        canDesk={canDesk}
        clinic={clinic}
        by={me.displayName}
      />
      {enrolling && (
        <Enrol
          open
          onOpenChange={setEnrolling}
          data={data}
          onOpenMember={fromDialog}
          onEnrol={(name, phone, programIds, family) => {
            const id = uid();
            const at = Date.now();
            change((d) => ({
              ...d,
              next: d.next + 1,
              members: [
                ...d.members,
                { id, no: memberNo(clinic, d.next), name, phone, joinedAt: at },
              ],
              enrollments: [
                ...d.enrollments,
                ...programIds.map((programId) => {
                  const c = d.programs.find((p) => p.id === programId)!.config;
                  return c.kind === "membership"
                    ? {
                        programId,
                        memberId: id,
                        since: at,
                        until: addMonths(at, c.months),
                        family,
                      }
                    : { programId, memberId: id, since: at };
                }),
              ],
            }));
            fromDialog(id);
            toast.success(`${name} is enrolled`);
          }}
        />
      )}
    </>
  );
}

function Programs({
  data,
  canEdit,
  enrolledIn,
  onEdit,
  onStart,
  onStatus,
  onSample,
}: {
  data: LoyaltyData;
  canEdit: boolean;
  enrolledIn: (id: string) => number;
  onEdit: (p: Program) => void;
  onStart: (k: Kind) => void;
  onStatus: (id: string, s: Program["status"]) => void;
  onSample: () => void;
}) {
  const now = Date.now();
  const recent = data.entries.filter((e) => e.at > now - 30 * DAY);
  const unused = kinds.filter(
    (k) => !data.programs.some((p) => p.config.kind === k),
  );
  const stats = [
    [
      "Members",
      new Set(
        data.enrollments
          .filter((e) => !e.cancelled && status(e, now) !== "expired")
          .map((e) => e.memberId),
      ).size,
      "in at least one program",
    ],
    [
      "Member visits",
      recent.filter((e) => e.type === "visit").length,
      "last 30 days",
    ],
    [
      "Rewards given",
      recent.filter((e) => rewarded.includes(e.type)).length,
      "perks, rewards and goals, last 30 days",
    ],
    [
      "Renewals due",
      data.enrollments.filter((e) => status(e, now) === "expiring").length,
      "memberships ending within 30 days",
    ],
  ] as const;
  return (
    <div className="space-y-8">
      {data.programs.length > 0 ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {stats.map(([label, value, hint]) => (
              <GrowthMetric key={label} label={label} value={value} context={hint} />
            ))}
          </div>
          <section className="space-y-3">
            <h2 className="font-semibold">Your programs</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.programs.map((p) => (
                <Panel key={p.id} className="gap-4 p-5 shadow-none">
                  <div className="flex items-start gap-3">
                    <KindIcon program={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.name}</h3>
                        <Badge
                          variant={p.status === "live" ? "default" : "outline"}
                          className={`font-normal ${p.status === "live" ? "bg-emerald-600" : ""}`}
                        >
                          {p.status === "live"
                            ? "Live"
                            : p.status === "paused"
                              ? "Paused"
                              : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {templates[p.config.kind].title}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm">{summary(p.config)}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      {enrolledIn(p.id)} members ·{" "}
                      {recent.filter((e) => e.programId === p.id).length}{" "}
                      activities this month
                    </p>
                    <div className="flex gap-2">
                      {canEdit && p.status !== "draft" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onStatus(
                              p.id,
                              p.status === "live" ? "paused" : "live",
                            )
                          }
                        >
                          {p.status === "live" ? "Pause" : "Resume"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(p)}
                      >
                        {canEdit
                          ? p.status === "draft"
                            ? "Finish setup"
                            : "Edit"
                          : "View"}
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="mx-auto max-w-2xl space-y-3 py-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Bring patients back
          </h2>
          <p className="text-muted-foreground">
            Pick a format that already works for hospitals, clinics and big
            brands. Run one, or mix a few. Exora keeps track of who earned what;
            you keep billing as it is.
          </p>
          {preview && canEdit && (
            <Button variant="outline" size="sm" onClick={onSample}>
              <Sparkles /> Load sample programs
            </Button>
          )}
        </div>
      )}
      {unused.length > 0 && (
        <section className="space-y-3">
          {data.programs.length > 0 && (
            <h2 className="font-semibold">Add another program</h2>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unused.map((k) => {
              const t = templates[k];
              return (
                <Panel key={k} className="gap-3 p-5 shadow-none">
                  <KindIcon program={t} />
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="flex-1 text-sm">{t.pitch}</p>
                  <p className="text-xs text-muted-foreground">{t.inspired}</p>
                  <Button
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onStart(k)}
                  >
                    Set up
                  </Button>
                </Panel>
              );
            })}
          </div>
          {preview && !canEdit && (
            <p className="text-sm text-muted-foreground">
              Ask an administrator to set up a program.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

function Members({
  data,
  canDesk,
  onOpen,
  onEnrol,
}: {
  data: LoyaltyData;
  canDesk: boolean;
  onOpen: (id: string) => void;
  onEnrol: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const now = Date.now();
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const list = data.members
    .filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.no.toLowerCase().includes(q) ||
        (digits.length > 2 && m.phone.replace(/\D/g, "").includes(digits)),
    )
    .filter((m) => {
      const ens = data.enrollments.filter((e) => e.memberId === m.id);
      return filter === "all"
        ? true
        : filter === "expiring"
          ? ens.some((e) => status(e, now) === "expiring")
          : ens.some((e) => e.programId === filter && !e.cancelled);
    })
    .sort((a, b) => b.joinedAt - a.joinedAt);
  const live = data.programs.filter((p) => p.status === "live");
  if (!data.programs.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Set up a program first. Members show up here once you enrol them.
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Name, phone or member ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Pick
          id="member-filter"
          className="w-52"
          value={filter}
          options={[
            ["all", "All members"],
            ["expiring", "Renewals due"],
            ...data.programs.map((p) => [p.id, p.name] as const),
          ]}
          onChange={setFilter}
        />
        <Button disabled={!canDesk || !live.length} onClick={onEnrol}>
          <UserPlus /> Enrol patient
        </Button>
      </div>
      {!list.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {data.members.length
            ? "No members match."
            : "No members yet. Enrol a patient at the desk to start."}
        </p>
      ) : (
        <Panel className="gap-0 p-0 shadow-none">
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-b p-3 text-left last:border-0 hover:bg-muted/50"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                {initials(m.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {m.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.no} · {m.phone}
                </span>
              </span>
              <span className="order-last flex w-full flex-wrap gap-1.5 pl-12 sm:order-none sm:w-auto sm:justify-end sm:pl-0">
                {data.enrollments
                  .filter((e) => e.memberId === m.id)
                  .map((e) => {
                    const p = data.programs.find((x) => x.id === e.programId);
                    if (!p) return null;
                    const st = status(e, now);
                    const s = standing(p, e, data.entries, now);
                    const warn =
                      st === "expiring" || (s.kind === "stamps" && s.ready);
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${st === "expired" || st === "cancelled" ? "text-muted-foreground line-through" : warn ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : ""}`}
                      >
                        <span
                          className={`size-2 rounded-full ${colors[p.color]}`}
                        />
                        {chip(s, e, now)}
                      </span>
                    );
                  })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}

function label(e: Entry, data: LoyaltyData) {
  const p = data.programs.find((x) => x.id === e.programId);
  const c = p?.config;
  switch (e.type) {
    case "visit":
      return "Visit recorded";
    case "earn":
      return `+${e.points} points · ${e.note}`;
    case "redeem":
      return `Redeemed ${e.note} · ${e.points} points`;
    case "stamp":
      return "Stamp added";
    case "stamp_reward":
      return `Full card reward given: ${e.note}`;
    case "use":
      return `${c?.kind === "membership" ? (c.perks.find((x) => x.id === e.ref)?.label ?? "Perk") : "Perk"} · ${e.note}`;
    case "referral":
      return `Referred ${e.note}`;
    case "referral_done":
      return `${e.note} had their first visit · both rewards unlocked`;
    case "goal":
      return `Goal done: ${c?.kind === "wellness" ? (c.goals.find((g) => g.id === e.ref)?.label ?? "") : ""}`;
    case "renew":
      return `Membership renewed until ${e.note}`;
  }
}

function MemberSheet({
  data,
  change,
  memberId,
  onClose,
  canDesk,
  clinic,
  by,
}: {
  data: LoyaltyData;
  change: Change;
  memberId: string | null;
  onClose: () => void;
  canDesk: boolean;
  clinic: string;
  by: string;
}) {
  // Keep the last member on screen while the sheet slides closed.
  const [last, setLast] = useState(memberId);
  if (memberId && memberId !== last) setLast(memberId);
  const m = data.members.find((x) => x.id === (memberId ?? last));
  return (
    <Sheet open={!!memberId && !!m} onOpenChange={(o) => o || onClose()}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        {m && (
          <MemberBody
            key={m.id}
            m={m}
            data={data}
            change={change}
            canDesk={canDesk}
            clinic={clinic}
            by={by}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function MemberBody({
  m,
  data,
  change,
  canDesk,
  clinic,
  by,
}: {
  m: Member;
  data: LoyaltyData;
  change: Change;
  canDesk: boolean;
  clinic: string;
  by: string;
}) {
  const now = Date.now();
  const mine = (
    e: { programId: string; memberId: string },
    programId: string,
  ) => e.memberId === m.id && e.programId === programId;
  const add = (...entries: Omit<Entry, "id" | "at" | "memberId" | "by">[]) =>
    change((d) => ({
      ...d,
      entries: [
        ...d.entries,
        ...entries.map((e) => ({
          ...e,
          id: uid(),
          at: Date.now(),
          memberId: m.id,
          by,
        })),
      ],
    }));
  const enrolled = data.enrollments.filter((e) => e.memberId === m.id);
  const joinable = data.programs.filter(
    (p) => p.status === "live" && !enrolled.some((e) => e.programId === p.id),
  );
  const history = data.entries
    .filter((e) => e.memberId === m.id)
    .sort((a, b) => b.at - a.at);
  const counted = enrolled.some((e) => {
    const k = data.programs.find((p) => p.id === e.programId)?.config.kind;
    return (k === "points" || k === "stamps" || k === "tiers") && !e.cancelled;
  });
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{m.name}</SheetTitle>
        <SheetDescription>
          {m.no} · {m.phone} · member since {day(m.joinedAt)}
        </SheetDescription>
        {counted && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              disabled={!canDesk}
              onClick={() => {
                change((d) => ({
                  ...d,
                  entries: [...d.entries, ...visit(d, m.id, by, Date.now())],
                }));
                toast.success("Visit recorded");
              }}
            >
              <BadgeCheck /> Record a visit
            </Button>
            <p className="text-xs text-muted-foreground">
              Adds points and a stamp, and counts toward their tier.
            </p>
          </div>
        )}
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        {enrolled.map((en) => {
          const p = data.programs.find((x) => x.id === en.programId);
          if (!p) return null;
          const s = standing(p, en, data.entries, now);
          const st = status(en, now);
          const off = !canDesk || st === "expired" || st === "cancelled";
          return (
            <Panel key={p.id} className="gap-4 p-4 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <KindIcon program={p} size="size-7" />
                  {p.name}
                </p>
                {p.status === "paused" && (
                  <Badge variant="outline" className="font-normal">
                    Program paused
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
                <Card program={p} clinic={clinic} member={m} en={en} s={s} />
                <div className="min-w-0 space-y-3 text-sm">
                  {s.kind === "membership" &&
                    p.config.kind === "membership" && (
                      <MembershipActions
                        perks={s.perks}
                        people={[m.name, ...(en.family ?? [])]}
                        st={st}
                        until={s.until}
                        cancelled={en.cancelled}
                        off={off}
                        canDesk={canDesk}
                        onUse={(perk, who) => (
                          add({
                            programId: p.id,
                            type: "use",
                            ref: perk,
                            note: who,
                          }),
                          toast.success("Perk recorded")
                        )}
                        onRenew={() => {
                          const until = renewUntil(
                            s.until,
                            p.config.kind === "membership"
                              ? p.config.months
                              : 12,
                            Date.now(),
                          );
                          change((d) => ({
                            ...d,
                            enrollments: d.enrollments.map((e) =>
                              mine(e, p.id) ? { ...e, until } : e,
                            ),
                          }));
                          add({
                            programId: p.id,
                            type: "renew",
                            note: day(until),
                          });
                          toast.success(`Renewed until ${day(until)}`);
                        }}
                        onCancel={() =>
                          change((d) => ({
                            ...d,
                            enrollments: d.enrollments.map((e) =>
                              mine(e, p.id)
                                ? { ...e, cancelled: Date.now() }
                                : e,
                            ),
                          }))
                        }
                      />
                    )}
                  {s.kind === "points" && p.config.kind === "points" && (
                    <>
                      <p className="font-medium">Add points</p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["Health check-up", p.config.checkup],
                            ["Referred a friend", p.config.referral],
                            ["Google review", p.config.review],
                          ] as const
                        )
                          .filter(([, n]) => n > 0)
                          .map(([what, n]) => (
                            <Button
                              key={what}
                              size="sm"
                              variant="outline"
                              disabled={off}
                              onClick={() => (
                                add({
                                  programId: p.id,
                                  type: "earn",
                                  points: n,
                                  note: what,
                                }),
                                toast.success(`+${n} points`)
                              )}
                            >
                              {what} · +{n}
                            </Button>
                          ))}
                      </div>
                      <p className="font-medium">Redeem</p>
                      {p.config.rewards.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>
                            {r.label}{" "}
                            <span className="text-muted-foreground">
                              · {r.cost} points
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={off || s.balance < r.cost}
                            title={
                              s.balance < r.cost
                                ? `Needs ${r.cost - s.balance} more points`
                                : undefined
                            }
                            onClick={() => (
                              add({
                                programId: p.id,
                                type: "redeem",
                                ref: r.id,
                                points: -r.cost,
                                note: r.label,
                              }),
                              toast.success(`${r.label} redeemed`)
                            )}
                          >
                            {s.balance < r.cost
                              ? `${r.cost - s.balance} more`
                              : "Redeem"}
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                  {s.kind === "stamps" && p.config.kind === "stamps" && (
                    <>
                      <p className="text-muted-foreground">
                        {p.config.counts} adds a stamp.{" "}
                        {s.earned > 0 &&
                          `${s.earned} full ${s.earned === 1 ? "card" : "cards"} so far.`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={off || s.ready}
                          onClick={() =>
                            add({ programId: p.id, type: "stamp" })
                          }
                        >
                          Add a stamp
                        </Button>
                        <Button
                          size="sm"
                          disabled={off || !s.ready}
                          onClick={() => (
                            add({
                              programId: p.id,
                              type: "stamp_reward",
                              note:
                                p.config.kind === "stamps"
                                  ? p.config.reward
                                  : "",
                            }),
                            toast.success(
                              "Reward given. A fresh card starts now.",
                            )
                          )}
                        >
                          <Gift /> Give reward
                        </Button>
                      </div>
                      {s.ready && (
                        <p className="text-amber-700 dark:text-amber-300">
                          The card is full: {lower(p.config.reward)} is
                          ready.
                        </p>
                      )}
                    </>
                  )}
                  {s.kind === "referral" && p.config.kind === "referral" && (
                    <Referrals
                      referrals={s.referrals}
                      left={s.left}
                      perYear={p.config.perYear}
                      off={off}
                      onAdd={(friend) =>
                        add({ programId: p.id, type: "referral", note: friend })
                      }
                      onDone={(e) => (
                        add({
                          programId: p.id,
                          type: "referral_done",
                          ref: e.id,
                          note: e.note,
                        }),
                        toast.success("Both rewards unlocked")
                      )}
                    />
                  )}
                  {s.kind === "tiers" && (
                    <p className="text-muted-foreground">
                      {s.visits} {s.visits === 1 ? "visit" : "visits"} in the
                      last 12 months.{" "}
                      {s.next
                        ? `${s.toNext} more for ${s.next.name}.`
                        : "Top tier."}{" "}
                      The tier updates with each recorded visit.
                    </p>
                  )}
                  {s.kind === "wellness" &&
                    s.goals.map(({ goal, done }) => (
                      <div
                        key={goal.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>
                          {goal.label}
                          <span className="block text-xs text-muted-foreground">
                            Reward: {goal.reward}
                          </span>
                        </span>
                        {done ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-700">
                            <Check className="size-3.5" /> Done
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={off}
                            onClick={() => (
                              add({
                                programId: p.id,
                                type: "goal",
                                ref: goal.id,
                              }),
                              toast.success(
                                `Goal done. ${goal.reward} unlocked.`,
                              )
                            )}
                          >
                            Mark done
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </Panel>
          );
        })}
        {joinable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Add to</span>
            {joinable.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="outline"
                disabled={!canDesk}
                onClick={() => {
                  const at = Date.now();
                  change((d) => ({
                    ...d,
                    enrollments: [
                      ...d.enrollments,
                      p.config.kind === "membership"
                        ? {
                            programId: p.id,
                            memberId: m.id,
                            since: at,
                            until: addMonths(at, p.config.months),
                            family: [],
                          }
                        : { programId: p.id, memberId: m.id, since: at },
                    ],
                  }));
                  toast.success(`Added to ${p.name}`);
                }}
              >
                <span className={`size-2 rounded-full ${colors[p.color]}`} />{" "}
                {p.name}
              </Button>
            ))}
          </div>
        )}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">History</h3>
          {!history.length && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet.
            </p>
          )}
          {history.slice(0, 30).map((e) => {
            const p = data.programs.find((x) => x.id === e.programId);
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 border-b pb-2 text-sm last:border-0"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${p ? colors[p.color] : "bg-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1">
                  {label(e, data)}
                  <span className="block text-xs text-muted-foreground">
                    {p?.name ?? "All programs"} · {day(e.at)} · {e.by}
                  </span>
                </span>
                {canDesk && sameDay(e.at, now) && e.type !== "renew" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // A visit takes its points and stamp with it; a referral takes its "first visit" with it.
                      change((d) => ({
                        ...d,
                        entries: d.entries.filter(
                          (x) =>
                            x.id !== e.id &&
                            !(x.memberId === m.id && x.ref === e.id) &&
                            !(
                              e.type === "visit" &&
                              x.memberId === m.id &&
                              x.at === e.at
                            ),
                        ),
                      }));
                      toast.success("Undone");
                    }}
                  >
                    <Undo2 /> Undo
                  </Button>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}

function MembershipActions({
  perks,
  people,
  st,
  until,
  cancelled,
  off,
  canDesk,
  onUse,
  onRenew,
  onCancel,
}: {
  perks: {
    perk: { id: string; label: string; limit: number | null };
    left: number | null;
  }[];
  people: string[];
  st: ReturnType<typeof status>;
  until: number;
  cancelled?: number;
  off: boolean;
  canDesk: boolean;
  onUse: (perk: string, who: string) => void;
  onRenew: () => void;
  onCancel: () => void;
}) {
  const [who, setWho] = useState(people[0]);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <p
        className={
          st === "active"
            ? "text-muted-foreground"
            : "text-amber-700 dark:text-amber-300"
        }
      >
        {st === "cancelled"
          ? `Cancelled on ${day(cancelled!)}.`
          : st === "expired"
            ? `Ended on ${day(until)}. Renew to use perks again.`
            : st === "expiring"
              ? `Ends on ${day(until)}. Time to renew.`
              : `Valid until ${day(until)}.`}
      </p>
      {people.length > 1 && (
        <div className="flex items-center gap-2">
          <Label
            htmlFor="perk-who"
            className="shrink-0 font-normal text-muted-foreground"
          >
            Used by
          </Label>
          <Pick
            id="perk-who"
            className="w-48"
            value={who}
            options={people.map((x) => [x, x] as const)}
            onChange={setWho}
          />
        </div>
      )}
      {perks.map(({ perk, left }) => (
        <div key={perk.id} className="flex items-center justify-between gap-3">
          <span>
            {perk.label}
            <span className="block text-xs text-muted-foreground">
              {left === null
                ? "Any time"
                : `${left} of ${perk.limit} left this year`}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={off || left === 0}
            title={left === 0 ? `All ${perk.limit} used this year` : undefined}
            onClick={() => onUse(perk.id, who)}
          >
            {left === 0 ? "All used" : "Use"}
          </Button>
        </div>
      ))}
      {st !== "cancelled" && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            size="sm"
            variant={st === "active" ? "outline" : "default"}
            disabled={!canDesk}
            onClick={onRenew}
          >
            Renew
          </Button>
          {confirm ? (
            <>
              <Button size="sm" variant="destructive" onClick={onCancel}>
                Yes, cancel membership
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm(false)}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canDesk}
              onClick={() => setConfirm(true)}
            >
              Cancel membership
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function Referrals({
  referrals,
  left,
  perYear,
  off,
  onAdd,
  onDone,
}: {
  referrals: { entry: Entry; done: boolean }[];
  left: number;
  perYear: number;
  off: boolean;
  onAdd: (friend: string) => void;
  onDone: (e: Entry) => void;
}) {
  const [friend, setFriend] = useState("");
  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (friend.trim()) onAdd(friend.trim());
          setFriend("");
        }}
      >
        <Input
          aria-label="Friend's name"
          placeholder="Friend's name"
          value={friend}
          disabled={off || !left}
          onChange={(e) => setFriend(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={off || !left || !friend.trim()}
        >
          Add referral
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {left
          ? `${left} of ${perYear} rewarded referrals left this year.`
          : `Reached this year's limit of ${perYear}.`}
      </p>
      {referrals.map(({ entry, done }) => (
        <div key={entry.id} className="flex items-center justify-between gap-3">
          <span>
            {entry.note}
            <span className="block text-xs text-muted-foreground">
              Referred {day(entry.at)}
            </span>
          </span>
          {done ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <Check className="size-3.5" /> Rewards unlocked
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={off || !left}
              onClick={() => onDone(entry)}
            >
              First visit done
            </Button>
          )}
        </div>
      ))}
    </>
  );
}

function Enrol({
  open,
  onOpenChange,
  data,
  onEnrol,
  onOpenMember,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: LoyaltyData;
  onEnrol: (
    name: string,
    phone: string,
    programIds: string[],
    family: string[],
  ) => void;
  onOpenMember: (id: string) => void;
}) {
  const live = data.programs.filter((p) => p.status === "live");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState(() => live.map((p) => p.id));
  const [family, setFamily] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const number = mobile(phone);
  const existing = number && data.members.find((m) => m.phone === number);
  const membership = live.find(
    (p) => p.config.kind === "membership" && picked.includes(p.id),
  );
  const room =
    membership?.config.kind === "membership" ? membership.config.people - 1 : 0;
  const problem = !name.trim()
    ? "Enter the patient's name."
    : !number
      ? "Enter a 10-digit Indian mobile number."
      : existing
        ? "already"
        : !picked.length
          ? "Pick at least one program."
          : null;
  const submit = () =>
    problem
      ? setTried(true)
      : onEnrol(
          name.trim(),
          number!,
          picked,
          membership ? family.map((f) => f.trim()).filter(Boolean) : [],
        );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrol a patient</DialogTitle>
          <DialogDescription>
            They'll get their card on WhatsApp. Takes about 30 seconds.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="enrol-name">Name</Label>
              <Input
                id="enrol-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enrol-phone">Mobile number</Label>
              <Input
                id="enrol-phone"
                inputMode="tel"
                placeholder="98450 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          {existing && (
            <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 p-3 text-sm">
              {existing.name} is already a member ({existing.no}).
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenMember(existing.id)}
              >
                Open {existing.name.split(" ")[0]}
              </Button>
            </p>
          )}
          <div className="space-y-2">
            <Label>Programs</Label>
            {live.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                <Checkbox label={p.name} description={summary(p.config)} checked={picked.includes(p.id)}
                  onCheckedChange={on => setPicked(on ? [...picked, p.id] : picked.filter(x => x !== p.id))} />
                <KindIcon program={p} size="size-6" />
              </div>
            ))}
            {data.programs.some((p) => p.status === "paused") && (
              <p className="text-xs text-muted-foreground">
                Paused programs don't take new members.
              </p>
            )}
          </div>
          {membership && room > 0 && (
            <div className="space-y-2">
              <Label>Family on the membership</Label>
              <p className="text-xs text-muted-foreground">
                Up to {room} more people. You collect the fee at your desk.
              </p>
              {family.map((f, i) => (
                <Input
                  key={i}
                  aria-label={`Family member ${i + 1}`}
                  placeholder="Name"
                  value={f}
                  onChange={(e) =>
                    setFamily(
                      family.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
              ))}
              {family.length < room && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFamily([...family, ""])}
                >
                  <UserPlus /> Add family member
                </Button>
              )}
            </div>
          )}
          {/* Lets Enter submit; the visible button sits in the footer. */}
          <button type="submit" hidden />
          {tried && problem && problem !== "already" && (
            <p className="text-sm text-destructive">{problem}</p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!!existing} onClick={submit}>
            Enrol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientView({ data, clinic }: { data: LoyaltyData; clinic: string }) {
  const members = data.members.filter((m) =>
    data.enrollments.some((e) => e.memberId === m.id && !e.cancelled),
  );
  const [id, setId] = useState(members[0]?.id ?? "");
  const m = members.find((x) => x.id === id) ?? members[0];
  if (!m)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Enrol a patient to see the card they get on WhatsApp.
      </p>
    );
  const now = Date.now();
  const ens = data.enrollments.filter(
    (e) => e.memberId === m.id && !e.cancelled,
  );
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pv-member">Member</Label>
          <Pick
            id="pv-member"
            className="w-full max-w-sm"
            value={m.id}
            options={members.map((x) => [x.id, `${x.name} · ${x.no}`] as const)}
            onChange={setId}
          />
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          This is what {m.name.split(" ")[0]} gets on WhatsApp after enrolling,
          and again whenever they ask for their card. Cards update as visits and
          rewards are recorded.
        </p>
        <Button
          disabled={!preview}
          onClick={() =>
            toast.info(
              "Preview only. Nothing was sent; cards go out on WhatsApp once the backend is connected.",
            )
          }
        >
          <WhatsAppIcon className="size-4" /> Send card on WhatsApp
        </Button>
      </div>
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border-8 border-foreground/90 bg-[#efeae2] shadow-lg dark:bg-[#0b141a]">
        <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
          <span className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-semibold">
            {initials(clinic)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{clinic}</span>
            <span className="block text-[11px] opacity-80">
              Business account
            </span>
          </span>
        </div>
        <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
          <p className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-2 text-sm shadow-sm dark:bg-[#202c33]">
            Hi {m.name.split(" ")[0]}, here{" "}
            {ens.length === 1 ? "is your card" : "are your cards"} at {clinic}.
            Show this at reception on your next visit.
          </p>
          {ens.map((en) => {
            const p = data.programs.find((x) => x.id === en.programId);
            return (
              p && (
                <div
                  key={p.id}
                  className="rounded-lg bg-white p-1.5 shadow-sm dark:bg-[#202c33]"
                >
                  <Card
                    program={p}
                    clinic={clinic}
                    member={m}
                    en={en}
                    s={standing(p, en, data.entries, now)}
                  />
                </div>
              )
            );
          })}
        </div>
      </div>
    </div>
  );
}
