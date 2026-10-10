import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitle } from "@/components/workspace";
import { Hint } from "./ui";
import inventory from "./original-ui-inventory.json";

const tabs: Record<string, string[]> = {
  whatsapp: [
    "Overview",
    "Conversations",
    "Doctor content",
    "Campaigns",
    "Follow-ups",
    "Delivery history",
    "Clinic details",
  ],
  voice: ["Call history", "Recordings", "Transcripts", "Access history"],
  google_business: [
    "Booking links",
    "Capabilities",
    "Change history",
    "Patient journey",
  ],
  growth_analytics: ["Analytics", "Patient journey", "Website activity"],
  loyalty: ["Program", "Members", "Patient view"],
  settings: ["Accounts", "Permissions", "Modules"],
};
export function PendingModule({ page }: { page: string }) {
  const item = inventory.find((s) => s[0] === page);
  const [selected, setSelected] = useState(tabs[page]?.[0] ?? "Overview");
  if (!item) return null;
  const [, title, , , features] = item;
  return (
    <div className="space-y-6">
      <PageTitle
        title={String(title)}
        description="Original workspace features retained for integration."
      />
      <Hint>
        {page === "loyalty"
          ? "This was a design concept in the original frontend. It has no live membership backend."
          : "This module was hidden in the first integration. Its original design is retained, but its data and actions need backend integration. No records, activity totals or delivery results are implied here."}
      </Hint>
      {tabs[page] && (
        <Tabs value={selected} onValueChange={setSelected}>
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs[page].map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <Card>
        <CardHeader>
          <div className="flex justify-between gap-3">
            <CardTitle>{tabs[page] ? selected : String(title)}</CardTitle>
            <Badge variant="outline">Awaiting integration</Badge>
          </div>
          <CardDescription>
            The original module's full forms and layouts remain in the selected
            source. This page restores its place in the workspace; connecting
            that full interface is still pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(features as string[]).map((feature) => (
            <div key={feature} className="border-b last:border-0 pb-3 text-sm">
              {feature}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
export function DesignGuide() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Original UI integration map"
        description="What was designed, what is connected and what remains to return."
      />
      <Hint>
        Your original source is preserved. Backend-dependent actions remain
        unavailable until their contracts are implemented. Original
        teleconsultation and loyalty concept screens remain separate from real
        operational data.
      </Hint>
      <div className="grid md:grid-cols-2 gap-5">
        {inventory.map(([key, title, , , features]) => (
          <Card key={String(key)}>
            <CardHeader>
              <CardTitle>{String(title)}</CardTitle>
              <CardDescription>
                {key === "schedules"
                  ? "Original timeline and local-draft editors restored; complete data and saves pending."
                  : key === "appointments"
                    ? "Core visits connected; advanced search, staff notes and range edits pending."
                    : key === "doctors"
                      ? "Directory and editor layout restored; profile writes pending."
                      : "See the original module and parity ledger for full detail."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(features as string[]).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
