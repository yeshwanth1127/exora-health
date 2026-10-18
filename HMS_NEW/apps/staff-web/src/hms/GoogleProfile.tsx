import { useEffect, useState, type ReactNode } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "@/components/toast-events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./hooks";
import { chatLink, validPhone } from "./whatsapp-setup";
import {
  checkedFields,
  days,
  descriptionIssues,
  draftDescription,
  facts,
  primaryFor,
  sameHours,
  sortHours,
  suggestCategories,
  type Exora,
  type FactId,
  type GbpData,
  type Listing,
  type Social,
} from "./google-profile";
import { ListingCard, type GChange } from "./GoogleBusiness";

const sections = [
  ["basics", "Basics"],
  ["buttons", "Buttons"],
  ["hours", "Hours"],
  ["categories", "Specialities"],
  ["about", "About"],
  ["services", "Services"],
  ["facts", "Facilities and payments"],
  ["social", "Social links"],
] as const;
const fieldNames = { name: "clinic name", address: "address", primaryCategory: "main category" } as const;

export function Profile({
  data,
  change,
  exora,
  section,
  canManage,
}: {
  data: GbpData;
  change: GChange;
  exora: Exora;
  section: string | null;
  canManage: boolean;
}) {
  const { go } = useWorkspace();
  const [draft, setDraft] = useState<Listing>(data.listing);
  const [waNumber, setWaNumber] = useState("+91");
  const [newCategory, setNewCategory] = useState("");
  useEffect(() => {
    if (section) document.getElementById(`gbp-${section}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [section]);
  const set = (patch: Partial<Listing>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.listing);
  const rechecked = checkedFields.filter((f) => draft[f] !== data.listing[f]);
  const issues = descriptionIssues(draft.description);
  const publish = () => {
    if (rechecked.length && !window.confirm(`Google checks a new ${rechecked.map((f) => fieldNames[f]).join(" and ")} before showing it, usually within a few days. Your listing stays as it is until then. Publish?`))
      return;
    const at = Date.now();
    change((d) => ({ ...d, listing: draft, checking: { ...d.checking, ...Object.fromEntries(rechecked.map((f) => [f, at])) } }));
    toast.success("Published to Google");
  };
  const suggested = suggestCategories(exora.specialities);
  const fromExora = (label: string, on: () => void, same: boolean) =>
    same ? (
      <span className="text-xs text-muted-foreground">Matches {label}</span>
    ) : (
      <Button size="xs" variant="outline" onClick={on}>
        Use {label}
      </Button>
    );
  return (
    <div className="grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)_360px]">
      <nav className="hidden xl:block" aria-label="Profile sections">
        <ul className="sticky top-6 space-y-1 text-sm">
          {sections.map(([id, label]) => (
            <li key={id}>
              <a href={`#gbp-${id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <fieldset disabled={!canManage} className="min-w-0 space-y-5 pb-20">
        <Section id="basics" title="Basics" text="How patients find and reach you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="gbp-name" label="Clinic name" hint="Use your real signboard name. Adding extra words can get a listing suspended.">
              <Input id="gbp-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field id="gbp-phone" label="Phone" hint={fromExora("clinic phone", () => set({ phone: exora.phone }), !exora.phone || draft.phone === exora.phone)}>
              <Input id="gbp-phone" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field id="gbp-website" label="Website" hint="Your own website, if you have one. The Book button is separate.">
              <Input id="gbp-website" value={draft.website} placeholder="https://" onChange={(e) => set({ website: e.target.value.trim() })} />
            </Field>
            <Field id="gbp-address" label="Address" hint={fromExora("clinic address", () => set({ address: exora.address }), !exora.address || draft.address === exora.address)}>
              <Input id="gbp-address" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
          </div>
        </Section>
        <Section id="buttons" title="Buttons" text="The quickest ways for patients to reach you, right under your name.">
          <Toggle
            title="Book appointment"
            text={draft.bookUrl ? `Opens ${draft.bookUrl}` : "Opens your Exora booking page with live times and fees."}
            on={!!draft.bookUrl}
            set={(on) => set({ bookUrl: on ? exora.bookUrl : null })}
          />
          <Toggle
            title="Chat on WhatsApp"
            text={draft.whatsappUrl ? `Opens ${draft.whatsappUrl}` : exora.whatsappUrl ? "Uses your connected WhatsApp number. Patients land in your booking menu." : "Add your WhatsApp number below, or set up WhatsApp booking first."}
            on={!!draft.whatsappUrl}
            set={(on) => set({ whatsappUrl: on ? (exora.whatsappUrl ?? (validPhone(waNumber) ? chatLink(waNumber) : null)) : null })}
            disabled={!exora.whatsappUrl && !validPhone(waNumber) && !draft.whatsappUrl}
          />
          {!exora.whatsappUrl && !draft.whatsappUrl && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field id="gbp-wa" label="WhatsApp number">
                <Input id="gbp-wa" className="w-48" value={waNumber} onChange={(e) => setWaNumber(e.target.value.trim())} />
              </Field>
              <Button variant="link" className="px-0" onClick={() => go("whatsapp")}>
                Set up WhatsApp booking instead
              </Button>
            </div>
          )}
        </Section>
        <Section
          id="hours"
          title="Opening hours"
          text="From your doctors' schedules. Change hours in Schedules and they flow here."
          action={fromExora("my schedule", () => set({ hours: exora.hours }), !exora.hours.length || sameHours(draft.hours, exora.hours))}
        >
          <div className="divide-y rounded-lg border">
            {days.map((name, day) => {
              const p = draft.hours.find((x) => x.day === day);
              const ours = exora.hours.find((x) => x.day === day);
              const differs = (p?.open ?? "") + (p?.close ?? "") !== (ours?.open ?? "") + (ours?.close ?? "");
              return (
                <div key={name} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-24 font-medium">{name}</span>
                  <Switch
                    checked={!!p}
                    aria-label={`Open on ${name}`}
                    onCheckedChange={(on) =>
                      set({ hours: sortHours(on ? [...draft.hours, ours ?? { day, open: "09:00", close: "18:00" }] : draft.hours.filter((x) => x.day !== day)) })
                    }
                  />
                  {p ? (
                    <span className="flex items-center gap-2">
                      <Input type="time" className="w-28" aria-label={`${name} opens`} value={p.open} onChange={(e) => set({ hours: draft.hours.map((x) => (x.day === day ? { ...x, open: e.target.value } : x)) })} />
                      to
                      <Input type="time" className="w-28" aria-label={`${name} closes`} value={p.close} onChange={(e) => set({ hours: draft.hours.map((x) => (x.day === day ? { ...x, close: e.target.value } : x)) })} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                  {differs && exora.hours.length > 0 && (
                    <span className="ml-auto text-xs text-amber-700">Schedule says {ours ? `${ours.open}–${ours.close}` : "closed"}</span>
                  )}
                </div>
              );
            })}
          </div>
          <Holidays draft={draft} set={set} />
        </Section>
        <Section id="categories" title="Specialities" text="Google uses these to show you for searches like “cardiologist near me”.">
          <div className="space-y-4">
            <Field id="gbp-primary" label="Main category" hint={`Suggested: ${primaryFor(exora)}`}>
              <div className="flex flex-wrap gap-2">
                {[...new Set(["Hospital", "Medical clinic", primaryFor(exora), draft.primaryCategory])].map((c) => (
                  <Chip key={c} on={draft.primaryCategory === c} onClick={() => set({ primaryCategory: c })}>
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>
            <div className="space-y-2">
              <Label>Also shows for (up to 9)</Label>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...suggested, ...draft.categories])].map((c) => {
                  const on = draft.categories.includes(c);
                  return (
                    <Chip
                      key={c}
                      on={on}
                      onClick={() => set({ categories: on ? draft.categories.filter((x) => x !== c) : [...draft.categories, c].slice(0, 9) })}
                    >
                      {c}
                    </Chip>
                  );
                })}
              </div>
              <div className="flex max-w-sm gap-2">
                <Input placeholder="Another speciality" aria-label="Add a speciality" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                <Button
                  variant="outline"
                  disabled={!newCategory.trim() || draft.categories.length >= 9}
                  onClick={() => {
                    set({ categories: [...new Set([...draft.categories, newCategory.trim()])] });
                    setNewCategory("");
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Suggested from your departments. Only pick what you really offer.</p>
            </div>
          </div>
        </Section>
        <Section
          id="about"
          title="About the clinic"
          text="What patients read before they call. Plain facts work best."
          action={
            <Button size="xs" variant="outline" onClick={() => set({ description: draftDescription(exora) })}>
              <Sparkles /> Write it for me
            </Button>
          }
        >
          <Textarea rows={6} aria-label="Description" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{draft.description.length}/750</p>
          {issues.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {issues.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          id="services"
          title="Services"
          text="Consultations, packages and tests patients can get. Prices are optional."
          action={exora.services.length > 0 && (
            <Button size="xs" variant="outline" onClick={() => set({ services: [...draft.services, ...exora.services.filter((s) => !draft.services.some((x) => x.name === s.name))] })}>
              Add from Catalogue
            </Button>
          )}
        >
          <div className="space-y-2">
            {draft.services.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={`Service ${i + 1}`} value={s.name} onChange={(e) => set({ services: draft.services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Input
                  aria-label={`Price for service ${i + 1}`}
                  className="w-28"
                  inputMode="numeric"
                  placeholder="₹ price"
                  value={s.price ?? ""}
                  onChange={(e) => set({ services: draft.services.map((x, j) => (j === i ? { ...x, price: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } : x)) })}
                />
                <Button size="icon-xs" variant="ghost" aria-label={`Remove service ${i + 1}`} onClick={() => set({ services: draft.services.filter((_, j) => j !== i) })}>
                  <X />
                </Button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => set({ services: [...draft.services, { name: "", price: null }] })}>
              <Plus /> Add service
            </Button>
          </div>
        </Section>
        <Section id="facts" title="Facilities and payments" text="Quick yes/no answers that show on your listing.">
          <div className="divide-y rounded-lg border">
            {(Object.keys(facts) as FactId[]).map((f) => (
              <div key={f} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{facts[f]}</span>
                <div className="flex gap-1">
                  {([true, false] as const).map((v) => (
                    <Chip key={String(v)} on={draft.facts[f] === v} onClick={() => set({ facts: { ...draft.facts, [f]: v } })}>
                      {v ? "Yes" : "No"}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section id="social" title="Social links" text="Shown on your listing so patients can follow you.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["facebook", "instagram", "youtube", "x"] as Social[]).map((k) => (
              <Field key={k} id={`gbp-${k}`} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)}>
                <Input id={`gbp-${k}`} placeholder={`https://${k === "x" ? "x" : k}.com/…`} value={draft.social[k] ?? ""} onChange={(e) => set({ social: { ...draft.social, [k]: e.target.value.trim() } })} />
              </Field>
            ))}
          </div>
        </Section>
      </fieldset>
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{dirty ? "Preview with your changes" : "Your listing on Google"}</p>
        <ListingCard listing={draft} rating={null} />
      </div>
      {dirty && canManage && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <p className="flex-1 text-sm">
              Unpublished changes
              {rechecked.length > 0 && <span className="text-muted-foreground"> · Google re-checks a new {rechecked.map((f) => fieldNames[f]).join(" and ")}</span>}
            </p>
            <Button variant="ghost" onClick={() => setDraft(data.listing)}>
              Discard
            </Button>
            <Button disabled={issues.length > 0} onClick={publish}>
              Publish to Google
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Holidays({ draft, set }: { draft: Listing; set: (p: Partial<Listing>) => void }) {
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  return (
    <div className="mt-5 space-y-2">
      <Label>Holiday closures</Label>
      {draft.holidays.map((h) => (
        <div key={h.date} className="flex items-center gap-3 text-sm">
          <span className="w-28 tabular-nums">{h.date}</span>
          <span className="flex-1">{h.label || "Closed"}</span>
          <Button size="icon-xs" variant="ghost" aria-label={`Remove ${h.date}`} onClick={() => set({ holidays: draft.holidays.filter((x) => x.date !== h.date) })}>
            <X />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Input type="date" className="w-40" aria-label="Holiday date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input className="w-48" placeholder="e.g. Diwali" aria-label="Holiday name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button
          variant="outline"
          disabled={!date}
          onClick={() => {
            set({ holidays: [...draft.holidays.filter((x) => x.date !== date), { date, closed: true, label }].sort((a, b) => a.date.localeCompare(b.date)) });
            setDate("");
            setLabel("");
          }}
        >
          Add closure
        </Button>
      </div>
    </div>
  );
}

function Section({ id, title, text, action, children }: { id: string; title: string; text: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card id={`gbp-${id}`} className="scroll-mt-6 gap-0 p-5 shadow-none">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Toggle({ title, text, on, set, disabled }: { title: string; text: string; on: boolean; set: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-0">
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{text}</span>
      </span>
      <Switch checked={on} disabled={disabled} aria-label={title} onCheckedChange={set} />
    </label>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${on ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1967d2]" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
