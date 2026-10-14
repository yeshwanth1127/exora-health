import { useState, type ReactNode } from "react";
import { AlertTriangle, CalendarCheck, Check, Copy, ExternalLink, Globe, Loader2, Mail, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PostHogIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy } from "./GoogleBusiness";
import { uid } from "./google-profile";
import { Pick } from "./whatsapp-ui";
import type { AChange, Clinic } from "./WebsiteAnalytics";
import { posthogIssues, regions, sameSite, siteKey, siteUrl, snippet, type AnalyticsData, type PostHogLink, type Provider, type Region, type Site } from "./website-analytics";

/** Sample numbers only exist in development builds until the backend counts real visits. */
export const preview = import.meta.env.DEV;

export const options: Record<Provider, { icon: ReactNode; name: string; tag: string; points: string[] }> = {
  exora: {
    icon: <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>,
    name: "Exora analytics",
    tag: "Recommended · included",
    points: ["Nothing to sign up for", "No cookie banner needed", "Your numbers stay with Exora"],
  },
  posthog: {
    icon: <span className="grid size-10 place-items-center rounded-lg bg-[#f9bd2b]/20 text-[#1d1f27] dark:text-[#f9bd2b]"><PostHogIcon className="size-6" /></span>,
    name: "PostHog",
    tag: "Your own PostHog account",
    points: ["Use the PostHog account your team already has", "Dig deeper in PostHog any time", "PostHog bills you after 1 million events a month"],
  },
};


function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  const d = Math.floor(m / 1440);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Status({ site }: { site: Site }) {
  const [dot, text] =
    site.status === "live"
      ? ["bg-emerald-600", site.lastVisit ? `Counting · last visit ${ago(site.lastVisit)}` : "Counting"]
      : site.status === "checking"
        ? ["bg-sky-500 animate-pulse", "Checking…"]
        : site.status === "not_found"
          ? ["bg-destructive", "Code not found"]
          : ["bg-amber-500", "Waiting for the code"];
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={`size-1.5 rounded-full ${dot}`} />
      {text}
    </Badge>
  );
}

export function Websites({ data, change, clinic, canManage }: { data: AnalyticsData; change: AChange; clinic: Clinic; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => data.sites.find((s) => s.kind === "own" && s.status !== "live")?.id ?? null);
  const code = snippet(location.origin, siteKey(clinic.facilityId));
  const patch = (id: string, p: Partial<Site>) => change((d) => ({ ...d, sites: d.sites.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const check = (id: string) => patch(id, { status: "checking", checkAt: Date.now() });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Websites we count</h2>
          <p className="text-sm text-muted-foreground">Every site uses the same line of code, whichever way you count visits.</p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add a website
          </Button>
        )}
      </div>
      <Card className="gap-0 divide-y p-0 shadow-none">
        {data.sites.map((s) => (
          <div key={s.id}>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                {s.kind === "booking" ? <CalendarCheck className="size-4" /> : <Globe className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.kind === "booking" ? "Exora booking page" : shortUrl(s.url)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.kind === "booking" ? `${new URL(s.url).host} · counted automatically` : `Your website · added ${ago(s.addedAt)}`}
                </p>
              </div>
              <Status site={s} />
              {s.kind === "own" && canManage && (
                <div className="flex gap-1">
                  <Button size="sm" variant={openId === s.id ? "secondary" : "outline"} onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                    {s.status === "live" ? "Code" : "Install"}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Stop counting ${shortUrl(s.url)}`}
                    onClick={() =>
                      window.confirm(`Stop counting visits on ${shortUrl(s.url)}? Remove the code from that site too.`) &&
                      change((d) => ({ ...d, sites: d.sites.filter((x) => x.id !== s.id) }))
                    }
                  >
                    <X />
                  </Button>
                </div>
              )}
            </div>
            {openId === s.id && <Install site={s} code={code} clinic={clinic} onCheck={() => check(s.id)} />}
          </div>
        ))}
      </Card>
      <AddSite
        open={adding}
        onOpenChange={setAdding}
        sites={data.sites}
        onAdd={(url) => {
          const id = uid();
          change((d) => ({ ...d, sites: [...d.sites, { id, url, kind: "own", status: "waiting", addedAt: Date.now() }] }));
          setOpenId(id);
          setAdding(false);
        }}
      />
    </div>
  );
}

function AddSite({ open, onOpenChange, sites, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; sites: Site[]; onAdd: (url: string) => void }) {
  const [value, setValue] = useState("");
  const url = siteUrl(value);
  const taken = url && sites.some((s) => s.kind === "own" && sameSite(s.url, url));
  const problem = !value.trim() ? null : !url ? "Enter a web address like srilakshmihospital.in" : taken ? "That website is already added." : null;
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), o || setValue(""))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add your website</DialogTitle>
          <DialogDescription>We'll give you one line of code to paste on it. It takes about 2 minutes.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url && !taken) onAdd(url);
          }}
        >
          <Label htmlFor="site-url">Website address</Label>
          <Input id="site-url" autoFocus placeholder="srilakshmihospital.in" value={value} onChange={(e) => setValue(e.target.value)} />
          {problem ? <p className="text-xs text-destructive">{problem}</p> : url && <p className="text-xs text-muted-foreground">We'll count visits on {shortUrl(url)}.</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!url || !!taken} onClick={() => url && onAdd(url)}>
            Add website
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const platforms = {
  wordpress: [
    "WordPress",
    [
      "In WordPress, go to Plugins → Add New and install the free “WPCode” plugin.",
      "Open Code Snippets → Header & Footer.",
      "Paste the line into the Header box and press Save Changes.",
    ],
  ],
  wix: [
    "Wix",
    [
      "In your Wix dashboard, open Settings → Custom Code (under Advanced).",
      "Press + Add Custom Code and paste the line.",
      "Choose All pages, place it in Head, and press Apply.",
    ],
  ],
  gtm: [
    "Google Tag Manager",
    ["Open your container and go to Tags → New.", "Choose Custom HTML and paste the line.", "Set the trigger to All Pages, save, then press Submit to publish."],
  ],
  developer: ["My developer", ["Send the line to whoever looks after your website.", "They paste it inside <head> on every page.", "Come back here and press Check."]],
} as const;

function Install({ site, code, clinic, onCheck }: { site: Site; code: string; clinic: Clinic; onCheck: () => void }) {
  const [platform, setPlatform] = useState<keyof typeof platforms>("wordpress");
  const message = `Hi, please add this line inside <head> on every page of ${shortUrl(site.url)}. It lets ${clinic.name} see visitor numbers in Exora. It sets no cookies and collects nothing personal.\n\n${code}`;
  return (
    <div className="space-y-5 border-t bg-muted/30 px-5 py-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">1. Copy this line</p>
        <div className="flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs">{code}</pre>
          <Button size="sm" variant="outline" onClick={() => copy(code, "Code copied")}>
            <Copy /> Copy
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">2. Paste it on every page</p>
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as keyof typeof platforms)}>
          <TabsList>
            {Object.entries(platforms).map(([k, [label]]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {platforms[platform][1].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {platform === "developer" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" nativeButton={false} render={<a href={`mailto:?subject=${encodeURIComponent("Visitor numbers for our website")}&body=${encodeURIComponent(message)}`} />}>
              <Mail /> Email it
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(message, "Message copied")}>
              <Copy /> Copy message
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">3. Check it works</p>
        {site.status === "live" ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> We can see visits from {shortUrl(site.url)}. You're done.
          </p>
        ) : (
          <>
            {site.status === "not_found" && (
              <p className="flex gap-2 rounded-md bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                No visits yet from {shortUrl(site.url)}. Check the line is on the live site (not a draft), then open the site once and try again.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={site.status === "checking"} onClick={onCheck}>
                {site.status === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check installation
              </Button>
              <span className="text-xs text-muted-foreground">Open your website once after pasting, then press Check.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Settings({ data, canManage, onExora, onPostHog }: { data: AnalyticsData; canManage: boolean; onExora: () => void; onPostHog: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const ph = data.posthog;
  return (
    <div className="max-w-3xl space-y-6">
      <Card className="gap-4 p-5 shadow-none">
        <div>
          <h2 className="text-sm font-semibold">How visits are counted</h2>
          <p className="text-sm text-muted-foreground">Switching keeps your past numbers. Nothing changes on your website.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["exora", "posthog"] as const).map((p) => {
            const o = options[p];
            const on = data.provider === p;
            return (
              <div key={p} className={`flex flex-col gap-3 rounded-lg border p-4 ${on ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  {o.icon}
                  {on && (
                    <Badge className="gap-1 font-normal">
                      <Check className="size-3" /> In use
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{o.tag}</p>
                </div>
                {!on && canManage && (
                  <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => (p === "exora" ? setConfirm(true) : onPostHog())}>
                    Switch to {o.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {data.switchedAt && <p className="text-xs text-muted-foreground">Switched {ago(data.switchedAt)}. Numbers before then came from the other option.</p>}
      </Card>
      {ph && (
        <Card className="gap-4 p-5 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <PostHogIcon className="size-4" /> PostHog connection
            </h2>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className={`size-1.5 rounded-full ${ph.status === "connected" ? "bg-emerald-600" : "animate-pulse bg-sky-500"}`} />
              {ph.status === "connected" ? `Connected ${ago(ph.since)}` : "Checking keys…"}
            </Badge>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Region</dt>
            <dd>{regions[ph.region].name}</dd>
            <dt className="text-muted-foreground">Project ID</dt>
            <dd className="font-mono">{ph.projectId}</dd>
            <dt className="text-muted-foreground">Project API key</dt>
            <dd className="font-mono">phc_••••{ph.keyEnd}</dd>
            <dt className="text-muted-foreground">Personal API key</dt>
            <dd className="font-mono">phx_••••{ph.readKeyEnd}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<a href={`${regions[ph.region].app}/project/${ph.projectId}`} target="_blank" rel="noreferrer" />}>
              Open PostHog <ExternalLink />
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={onPostHog}>
                  Replace keys
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
                  Disconnect PostHog
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
      <Card className="gap-3 p-5 shadow-none">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" /> What's never collected
        </h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {["Names, phone numbers or booking details", "Anything typed into forms", "Cookies or visitor IDs, so no cookie banner is needed", "Screen recordings"].map((t) => (
            <li key={t} className="flex gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to Exora analytics?</DialogTitle>
            <DialogDescription>
              New visits will be counted by Exora. Your past numbers stay.{ph ? " We'll stop sending visits to PostHog and delete your PostHog keys from Exora." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => (onExora(), setConfirm(false))}>Switch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PostHogDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (link: PostHogLink) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <PostHogForm onCancel={() => onOpenChange(false)} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}

function PostHogForm({ onCancel, onSave }: { onCancel: () => void; onSave: (link: PostHogLink) => void }) {
  const [region, setRegion] = useState<Region>("eu");
  const [f, setF] = useState({ projectId: "", projectKey: "", readKey: "" });
  const [help, setHelp] = useState(false);
  const issues = posthogIssues(f);
  const touched = Object.values(f).some(Boolean);
  const field = (k: keyof typeof f, label: string, placeholder: string, secret = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ph-${k}`}>{label}</Label>
      <Input
        id={`ph-${k}`}
        type={secret ? "password" : "text"}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="font-mono"
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PostHogIcon className="size-5" /> Connect PostHog
        </DialogTitle>
        <DialogDescription>Exora sends your website visits to your PostHog project and shows the totals here.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ph-region">Region</Label>
            <Pick id="ph-region" value={region} options={(Object.keys(regions) as Region[]).map((r) => [r, regions[r].name] as const)} onChange={setRegion} />
          </div>
          {field("projectId", "Project ID", "84213")}
        </div>
        {field("projectKey", "Project API key", "phc_…")}
        {field("readKey", "Personal API key (read only)", "phx_…", true)}
        <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={() => setHelp(!help)}>
          Where do I find these?
        </button>
        {help && (
          <ol className="list-decimal space-y-1 rounded-md bg-muted/50 p-3 pl-8 text-xs">
            <li>In PostHog, open Settings → Project. Copy the Project ID and the Project API key.</li>
            <li>Open Settings → Personal API keys → Create personal API key.</li>
            <li>Give it read access to Query only, then copy the key. PostHog shows it once.</li>
          </ol>
        )}
        {touched && issues.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          PostHog is free up to 1 million events a month, then charges your account. Exora keeps your keys on its server and only shows the last 4 characters.
          {!preview && " Connecting PostHog opens with the next update."}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={issues.length > 0 || !preview}
          onClick={() => {
            onSave({ region, projectId: f.projectId.trim(), keyEnd: f.projectKey.trim().slice(-4), readKeyEnd: f.readKey.trim().slice(-4), status: "testing", since: Date.now() });
          }}
        >
          Test and connect
        </Button>
      </DialogFooter>
    </>
  );
}
