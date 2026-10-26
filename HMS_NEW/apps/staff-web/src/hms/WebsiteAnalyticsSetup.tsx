import { GrowthConfirm } from "./GrowthConfirm";
import { useConfirmationReview } from "./use-confirmation-review";
import { reviewedTarget } from "./growth-confirmation";
import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "./GoogleBusiness";
import { siteUrl, type Site, type AnalyticsData } from "./website-analytics";
import type { AChange, Clinic } from "./WebsiteAnalytics";

// Other modules still use a development-only preview flag. Analytics itself never uses sample data.
export const preview = import.meta.env.DEV;

export function Websites({
  data,
  change,
  canManage,
}: {
  data: AnalyticsData;
  change: AChange;
  clinic: Clinic;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false),
    [value, setValue] = useState("");
  const url = siteUrl(value);
  const removal = useConfirmationReview<Site>();
  const target = reviewedTarget(data.sites, removal.target);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Websites we count</h2>
          <p className="text-sm text-muted-foreground">
            Add your website, install the code once, and see visits here.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding(!adding)}>
            <Plus /> Add a website
          </Button>
        )}
      </div>
      {adding && (
        <Card className="gap-3 p-5 shadow-none">
          <Label htmlFor="site-url">Website address</Label>
          <Input
            id="site-url"
            placeholder="https://yourclinic.in"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use your public HTTPS website address.
          </p>
          <Button
            disabled={!url || !canManage}
            onClick={() => {
              if (url)
                void change((d) => ({
                  ...d,
                  sites: [
                    ...d.sites,
                    {
                      id: "new",
                      url,
                      kind: "own",
                      status: "waiting",
                      addedAt: Date.now(),
                    },
                  ],
                })).then(() => {
                  setAdding(false);
                  setValue("");
                });
            }}
          >
            Add website
          </Button>
        </Card>
      )}
      <Card className="gap-0 divide-y p-0 shadow-none">
        {data.sites.length ? (
          data.sites.map((site) => (
            <div key={site.id} className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Globe className="size-5" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {new URL(site.url).host}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {site.lastVisit
                      ? `Last visit ${new Date(site.lastVisit).toLocaleString()}`
                      : "No visit received yet"}
                  </p>
                </div>
                <Badge variant="outline">
                  {site.status === "live" ? "Counting" : "Waiting for a visit"}
                </Badge>
                {canManage && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Stop counting ${site.url}`}
                    onClick={() => removal.request(site)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {site.code && (
                <div className="space-y-2">
                  <p className="text-sm">
                    Paste this line inside the <code>&lt;head&gt;</code> of your
                    website once.
                  </p>
                  <div className="flex gap-2">
                    <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {site.code}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(site.code!, "Code copied")}
                    >
                      <Copy /> Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open your website after installing, then refresh. Counting
                    starts after a real visit is received.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void change((d) => d)}
                  >
                    <RefreshCw /> Check installation
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Add a website to start counting visits. No sample traffic is shown.
          </p>
        )}
      </Card>
      <GrowthConfirm
        open={removal.open}
        onDismiss={removal.dismiss}
        title="Stop counting this website?"
        description={`Remove ${removal.target?.url ?? "this website"} from the recorded sites?`}
        confirmLabel="Remove website"
        blockedReason={
          !canManage
            ? "You no longer have permission to manage websites."
            : !target
              ? "This website changed. Review it again."
              : undefined
        }
        onConfirm={() => {
          if (canManage && target)
            void change((d) => ({
              ...d,
              sites: d.sites.filter((site) => site.id !== target.id),
            }));
        }}
      />
    </div>
  );
}
export function Settings({
  data,
}: {
  data: AnalyticsData;
  canManage: boolean;
  onExora?: () => void;
  onPostHog?: () => void;
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <Card className="gap-3 p-5 shadow-none">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" /> Managed by Paperwhale
        </h2>
        <p className="text-sm text-muted-foreground">
          Your website analytics is managed here. No separate account or login
          is needed.
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Check className="size-4" />{" "}
          {data.posthogEnabled
            ? "Additional insights are enabled by Paperwhale."
            : "Visitor and click counts appear in this dashboard."}
        </p>
      </Card>
      <Card className="gap-3 p-5 shadow-none">
        <h2 className="text-sm font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          We count visits and a small set of clicks on public pages. Form
          contents, names, phone numbers, booking details and screen recordings
          are excluded. Browser privacy signals are respected.
        </p>
        <p className="text-sm text-muted-foreground">
          Add this measurement to your website privacy notice and apply the
          consent requirements for your website.
        </p>
      </Card>
    </div>
  );
}
