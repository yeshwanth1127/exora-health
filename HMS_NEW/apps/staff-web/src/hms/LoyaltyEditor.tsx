import { useState, type ComponentType, type ReactNode } from "react";
import {
  Check,
  Coins,
  Crown,
  Gift,
  HeartPulse,
  IdCard,
  Plus,
  Stamp,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pick } from "./whatsapp-ui";
import { Note } from "./WhatsAppAutomations";
import {
  addMonths,
  day,
  lower,
  programIssues,
  standing,
  templates,
  uid,
  type Color,
  type Config,
  type Enrollment,
  type Kind,
  type Member,
  type Program,
  type Standing,
} from "./loyalty-program";

export const icons: Record<Kind, ComponentType<{ className?: string }>> = {
  membership: IdCard,
  points: Coins,
  stamps: Stamp,
  referral: UserPlus,
  tiers: Crown,
  wellness: HeartPulse,
};
export const colors: Record<Color, string> = {
  emerald: "bg-emerald-700",
  sky: "bg-sky-700",
  violet: "bg-violet-700",
  amber: "bg-amber-600",
  rose: "bg-rose-700",
  slate: "bg-slate-800",
};
const text: Record<Color, string> = {
  emerald: "text-emerald-700",
  sky: "text-sky-700",
  violet: "text-violet-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  slate: "text-slate-800",
};
const bar: Record<Color, string> = {
  emerald: "bg-emerald-600",
  sky: "bg-sky-600",
  violet: "bg-violet-600",
  amber: "bg-amber-500",
  rose: "bg-rose-600",
  slate: "bg-slate-700",
};

export function KindIcon({
  program,
  size = "size-9",
}: {
  program: { color: Color; config: Config };
  size?: string;
}) {
  const Icon = icons[program.config.kind];
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-lg text-white ${colors[program.color]}`}
    >
      <Icon className="size-[55%]" />
    </span>
  );
}

const sampleMember: Member = {
  id: "preview",
  no: "SL-0001",
  name: "Maya Rao",
  phone: "",
  joinedAt: 0,
};

/** A new member's card, for the editor preview. */
function PreviewCard({
  program,
  clinic,
}: {
  program: Program;
  clinic: string;
}) {
  const now = Date.now();
  const en: Enrollment = {
    programId: program.id,
    memberId: sampleMember.id,
    since: now,
    until:
      program.config.kind === "membership"
        ? addMonths(now, program.config.months)
        : undefined,
  };
  return (
    <Card
      program={program}
      clinic={clinic}
      member={sampleMember}
      en={en}
      s={standing(program, en, [], now)}
    />
  );
}
/** The card a patient sees on WhatsApp. */
export function Card({
  program,
  clinic,
  member,
  en,
  s,
}: {
  program: Program;
  clinic: string;
  member: Member;
  en: Enrollment;
  s: Standing;
}) {
  const c = program.config;
  return (
    <div className="overflow-hidden rounded-xl border bg-background text-left shadow-sm">
      <div className={`${colors[program.color]} space-y-3 p-4 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider opacity-80">
              {clinic}
            </p>
            <p className="truncate font-semibold">
              {program.name || templates[c.kind].name}
            </p>
          </div>
          {(() => {
            const Icon = icons[c.kind];
            return <Icon className="size-5 shrink-0 opacity-90" />;
          })()}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{member.name}</p>
            <p className="font-mono text-[11px] opacity-80">{member.no}</p>
          </div>
          {s.kind === "membership" && (
            <p className="text-right text-[11px] opacity-90">
              Valid until
              <br />
              <span className="text-xs font-medium">{day(s.until)}</span>
            </p>
          )}
          {s.kind === "points" && (
            <p className="text-right">
              <span className="text-2xl font-semibold">
                {s.balance.toLocaleString("en-IN")}
              </span>
              <span className="ml-1 text-xs opacity-80">points</span>
            </p>
          )}
          {s.kind === "tiers" && (
            <p className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
              {s.tier.name}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2 p-4 text-xs">
        {s.kind === "membership" && c.kind === "membership" && (
          <>
            {!!en.family?.length && (
              <p className="text-muted-foreground">
                Also covers {en.family.join(", ")}
              </p>
            )}
            {s.perks.map(({ perk, left }) => (
              <p key={perk.id} className="flex justify-between gap-3">
                <span>{perk.label || "Perk"}</span>
                <span className="shrink-0 text-muted-foreground">
                  {left === null ? "Any time" : `${left} of ${perk.limit} left`}
                </span>
              </p>
            ))}
          </>
        )}
        {s.kind === "points" && c.kind === "points" && (
          <>
            {s.next ? (
              <>
                <Progress
                  value={s.balance}
                  max={s.next.cost}
                  color={program.color}
                />
                <p>
                  <span className="font-medium">{s.toNext} more points</span>{" "}
                  for {lower(s.next.label)}
                </p>
              </>
            ) : (
              <p className="font-medium">
                You can redeem any reward. Ask at reception.
              </p>
            )}
            <p className="text-muted-foreground">
              Earn {c.visit} a visit
              {c.checkup ? `, ${c.checkup} for a check-up` : ""}
              {c.referral ? `, ${c.referral} for a referral` : ""}.
            </p>
          </>
        )}
        {s.kind === "stamps" && c.kind === "stamps" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: s.every }, (_, i) => (
                <span
                  key={i}
                  className={`grid size-7 place-items-center rounded-full border-2 ${i < s.count ? `${colors[program.color]} border-transparent text-white` : "border-dashed"}`}
                >
                  {i < s.count ? (
                    <Check className="size-3.5" />
                  ) : i === s.every - 1 ? (
                    <Gift className="size-3.5 text-muted-foreground" />
                  ) : null}
                </span>
              ))}
            </div>
            <p>
              {s.ready ? (
                <span className="font-medium">
                  Your reward is ready. Show this at reception.
                </span>
              ) : (
                <>
                  {s.every - s.count} more{" "}
                  {s.every - s.count === 1 ? "visit" : "visits"} for{" "}
                  {lower(c.reward) || "your reward"}
                </>
              )}
            </p>
          </>
        )}
        {s.kind === "referral" && c.kind === "referral" && (
          <>
            <p>
              Share your code{" "}
              <span
                className={`font-mono font-semibold ${text[program.color]}`}
              >
                {member.no}
              </span>{" "}
              with a friend.
            </p>
            <p className="text-muted-foreground">
              After their first visit, you get{" "}
              {lower(c.forReferrer) || "a reward"} and they get{" "}
              {lower(c.forFriend) || "a reward"}.
            </p>
            {s.referrals.length > 0 && (
              <p>
                {s.referrals.filter((r) => r.done).length} friends referred so
                far
              </p>
            )}
          </>
        )}
        {s.kind === "tiers" && (
          <>
            <p>{s.tier.perks}</p>
            {s.next && (
              <>
                <Progress
                  value={s.visits - s.tier.visits}
                  max={s.next.visits - s.tier.visits}
                  color={program.color}
                />
                <p className="text-muted-foreground">
                  {s.toNext} more {s.toNext === 1 ? "visit" : "visits"} this
                  year for {s.next.name}
                </p>
              </>
            )}
          </>
        )}
        {s.kind === "wellness" &&
          s.goals.map(({ goal, done }) => (
            <p key={goal.id} className="flex gap-2">
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${done ? `${colors[program.color]} border-transparent text-white` : ""}`}
              >
                {done && <Check className="size-3" />}
              </span>
              <span>
                <span className={done ? "line-through opacity-60" : ""}>
                  {goal.label || "Goal"}
                </span>
                <span className="block text-muted-foreground">
                  {goal.reward}
                </span>
              </span>
            </p>
          ))}
      </div>
    </div>
  );
}

export function Progress({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: Color;
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${bar[color]}`}
        style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%` }}
      />
    </div>
  );
}

export function newProgram(kind: Kind): Program {
  const t = templates[kind];
  return {
    id: uid(),
    name: t.name,
    color: t.color,
    status: "draft",
    createdAt: Date.now(),
    config: structuredClone(t.config),
  };
}

const num = (v: string) => (v === "" ? 0 : Number(v));

export function Editor({
  program,
  saved,
  clinic,
  members,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  program: Program | null;
  saved: boolean;
  clinic: string;
  members: number;
  canEdit: boolean;
  onClose: () => void;
  onSave: (p: Program) => void;
  onDelete: (id: string) => void;
}) {
  // Keep the last program on screen while the sheet slides closed.
  const [last, setLast] = useState({ program, saved });
  if (program && program !== last.program) setLast({ program, saved });
  const shown = program ?? last.program;
  return (
    <Sheet open={!!program} onOpenChange={(o) => o || onClose()}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-4xl">
        {shown && (
          <EditorBody
            key={shown.id}
            start={shown}
            saved={program ? saved : last.saved}
            clinic={clinic}
            members={members}
            canEdit={canEdit}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorBody({
  start,
  saved,
  clinic,
  members,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  start: Program;
  saved: boolean;
  clinic: string;
  members: number;
  canEdit: boolean;
  onClose: () => void;
  onSave: (p: Program) => void;
  onDelete: (id: string) => void;
}) {
  const [p, setP] = useState(start);
  const [tried, setTried] = useState(false);
  const c = p.config;
  const set = (patch: Partial<Config>) =>
    setP((x) => ({ ...x, config: { ...x.config, ...patch } as Config }));
  const issues = programIssues(p);
  const t = templates[c.kind];
  const save = (status: Program["status"]) => {
    if (status !== "draft" && issues.length) return setTried(true);
    onSave({ ...p, name: p.name.trim(), status });
  };
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-3">
          <KindIcon program={p} size="size-8" />
          {!saved
            ? `Set up ${t.title.toLowerCase()}`
            : `Edit ${p.name || t.title}`}
        </SheetTitle>
        <SheetDescription>{t.pitch}</SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 px-4 lg:grid-cols-[1fr_300px]">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="lp-name">Program name</Label>
              <Input
                id="lp-name"
                value={p.name}
                maxLength={40}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Card colour</Label>
              <div className="flex h-9 items-center gap-1.5">
                {(Object.keys(colors) as Color[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={k}
                    aria-pressed={p.color === k}
                    onClick={() => setP({ ...p, color: k })}
                    className={`size-7 rounded-full ${colors[k]} ring-offset-2 ring-offset-background ${p.color === k ? "ring-2 ring-ring" : ""}`}
                  />
                ))}
              </div>
            </div>
          </div>
          {start.status !== "draft" && members > 0 && (
            <Note>
              Changes show on all {members} members' cards. Perks and rewards
              they already used stay in their history.
            </Note>
          )}

          {c.kind === "membership" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="lp-fee"
                  label="Fee (₹)"
                  value={c.fee}
                  onChange={(v) => set({ fee: v })}
                />
                <div className="space-y-2">
                  <Label htmlFor="lp-months">Lasts</Label>
                  <Pick
                    id="lp-months"
                    value={String(c.months) as "6" | "12"}
                    options={[
                      ["6", "6 months"],
                      ["12", "12 months"],
                    ]}
                    onChange={(v) => set({ months: Number(v) as 6 | 12 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-people">Covers</Label>
                  <Pick
                    id="lp-people"
                    value={String(c.people)}
                    options={[1, 2, 3, 4, 5, 6].map(
                      (n) =>
                        [
                          String(n),
                          n === 1 ? "1 person" : `Up to ${n} people`,
                        ] as const,
                    )}
                    onChange={(v) => set({ people: Number(v) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You collect the fee at your desk. Paperwhale doesn't handle payments
                or bills; it keeps track of who is a member and what they've
                used.
              </p>
              <Rows
                title="Perks"
                hint="Leave the yearly limit empty for perks members can use any time, like a discount."
                items={c.perks}
                onAdd={() =>
                  set({
                    perks: [...c.perks, { id: uid(), label: "", limit: 1 }],
                  })
                }
                onRemove={(i) =>
                  set({ perks: c.perks.filter((_, j) => j !== i) })
                }
                render={(perk, i) => (
                  <>
                    <Input
                      aria-label="Perk"
                      placeholder="Free follow-up consultation"
                      value={perk.label}
                      onChange={(e) =>
                        set({
                          perks: c.perks.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Input
                      aria-label="Times a year"
                      className="w-28"
                      type="number"
                      min={1}
                      placeholder="No limit"
                      value={perk.limit ?? ""}
                      onChange={(e) =>
                        set({
                          perks: c.perks.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  limit:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        })
                      }
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">a year</span>
                  </>
                )}
              />
            </>
          )}

          {c.kind === "points" && (
            <>
              <div className="space-y-2">
                <Label>Points patients earn</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field
                    id="lp-visit"
                    label="Each visit"
                    value={c.visit}
                    onChange={(v) => set({ visit: v })}
                  />
                  <Field
                    id="lp-checkup"
                    label="Health check-up"
                    value={c.checkup}
                    onChange={(v) => set({ checkup: v })}
                  />
                  <Field
                    id="lp-ref"
                    label="Referring a friend"
                    value={c.referral}
                    onChange={(v) => set({ referral: v })}
                  />
                  <Field
                    id="lp-review"
                    label="Google review"
                    value={c.review}
                    onChange={(v) => set({ review: v })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use 0 to switch one off. Points never expire.
                </p>
              </div>
              <Rows
                title="Rewards"
                items={c.rewards}
                onAdd={() =>
                  set({
                    rewards: [
                      ...c.rewards,
                      { id: uid(), label: "", cost: 100 },
                    ],
                  })
                }
                onRemove={(i) =>
                  set({ rewards: c.rewards.filter((_, j) => j !== i) })
                }
                render={(r, i) => (
                  <>
                    <Input
                      aria-label="Reward"
                      placeholder="Free BP and sugar check"
                      value={r.label}
                      onChange={(e) =>
                        set({
                          rewards: c.rewards.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Input
                      aria-label="Points"
                      className="w-28"
                      type="number"
                      min={1}
                      value={r.cost || ""}
                      onChange={(e) =>
                        set({
                          rewards: c.rewards.map((x, j) =>
                            j === i ? { ...x, cost: num(e.target.value) } : x,
                          ),
                        })
                      }
                    />
                  </>
                )}
              />
            </>
          )}

          {c.kind === "stamps" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="lp-every"
                label="Stamps for a full card"
                value={c.every}
                onChange={(v) => set({ every: v })}
              />
              <div className="space-y-2">
                <Label htmlFor="lp-counts">What counts</Label>
                <Pick
                  id="lp-counts"
                  value={c.counts}
                  options={[
                    "Any visit",
                    "Consultations",
                    "Follow-ups",
                    "Physiotherapy sessions",
                    "Dental visits",
                  ].map((x) => [x, x] as const)}
                  onChange={(v) => set({ counts: v })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lp-reward">A full card earns</Label>
                <Input
                  id="lp-reward"
                  value={c.reward}
                  onChange={(e) => set({ reward: e.target.value })}
                />
              </div>
            </div>
          )}

          {c.kind === "referral" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lp-for-ref">The patient gets</Label>
                <Input
                  id="lp-for-ref"
                  value={c.forReferrer}
                  onChange={(e) => set({ forReferrer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lp-for-friend">Their friend gets</Label>
                <Input
                  id="lp-for-friend"
                  value={c.forFriend}
                  onChange={(e) => set({ forFriend: e.target.value })}
                />
              </div>
              <Field
                id="lp-per-year"
                label="Rewarded referrals a year, per patient"
                value={c.perYear}
                onChange={(v) => set({ perYear: v })}
              />
              <p className="self-end text-xs text-muted-foreground sm:pb-2">
                Rewards unlock once the friend's first visit is done, not when
                they're referred.
              </p>
            </div>
          )}

          {c.kind === "tiers" && (
            <Rows
              title="Tiers"
              hint="Visits in the last 12 months decide the tier. Everyone starts in the first one."
              items={c.tiers}
              onAdd={() =>
                set({
                  tiers: [
                    ...c.tiers,
                    {
                      name: "",
                      visits: (c.tiers.at(-1)?.visits ?? 0) + 4,
                      perks: "",
                    },
                  ],
                })
              }
              onRemove={(i) =>
                i > 0 && set({ tiers: c.tiers.filter((_, j) => j !== i) })
              }
              render={(tier, i) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-[8rem_6rem_1fr]">
                  <Input
                    aria-label="Tier name"
                    placeholder="Gold"
                    value={tier.name}
                    onChange={(e) =>
                      set({
                        tiers: c.tiers.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label="Visits needed"
                    type="number"
                    min={0}
                    disabled={i === 0}
                    value={tier.visits}
                    onChange={(e) =>
                      set({
                        tiers: c.tiers.map((x, j) =>
                          j === i ? { ...x, visits: num(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label="Perks"
                    placeholder="Priority appointment slots"
                    value={tier.perks}
                    onChange={(e) =>
                      set({
                        tiers: c.tiers.map((x, j) =>
                          j === i ? { ...x, perks: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </div>
              )}
            />
          )}

          {c.kind === "wellness" && (
            <Rows
              title="Goals for the year"
              hint="Reception marks a goal done when the patient completes it. Goals start again each January."
              items={c.goals}
              onAdd={() =>
                set({
                  goals: [...c.goals, { id: uid(), label: "", reward: "" }],
                })
              }
              onRemove={(i) =>
                set({ goals: c.goals.filter((_, j) => j !== i) })
              }
              render={(g, i) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    aria-label="Goal"
                    placeholder="Yearly health check-up"
                    value={g.label}
                    onChange={(e) =>
                      set({
                        goals: c.goals.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label="Reward"
                    placeholder="Free dietitian session"
                    value={g.reward}
                    onChange={(e) =>
                      set({
                        goals: c.goals.map((x, j) =>
                          j === i ? { ...x, reward: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </div>
              )}
            />
          )}
          <p className="text-xs text-muted-foreground">{t.inspired}</p>
        </fieldset>
        <div className="space-y-2 lg:sticky lg:top-0 lg:self-start">
          <p className="text-xs font-medium text-muted-foreground">
            What patients see
          </p>
          <PreviewCard program={p} clinic={clinic} />
        </div>
      </div>
      <SheetFooter className="border-t">
        {tried && issues.length > 0 && (
          <ul className="space-y-1 text-sm text-destructive">
            {issues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2">
            {saved && !members && (
              <Button
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => onDelete(p.id)}
              >
                Delete program
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {start.status === "draft" ? (
              <>
                <Button variant="outline" onClick={() => save("draft")}>
                  Save as draft
                </Button>
                <Button onClick={() => save("live")}>Go live</Button>
              </>
            ) : (
              <Button onClick={() => save(start.status)}>Save changes</Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only administrators can change programs.
          </p>
        )}
      </SheetFooter>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(num(e.target.value))}
      />
    </div>
  );
}

function Rows<T>({
  title,
  hint,
  items,
  render,
  onAdd,
  onRemove,
}: {
  title: string;
  hint?: string;
  items: T[];
  render: (item: T, i: number) => ReactNode;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {render(item, i)}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove"
            onClick={() => onRemove(i)}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus /> Add
      </Button>
    </div>
  );
}
