import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommand, useQuery, useWorkspace } from "./hooks";

type Settings = {
  facilityId: string;
  version: string | null;
  demoEnabled: boolean;
  content: Record<string, unknown>;
};
type Enquiry = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  context: string | null;
  status: string;
  createdAt: string;
  version: number;
};
export function WebsiteSettingsPanel() {
  const { facility, go } = useWorkspace(),
    path = `/v1/facilities/${facility.facilityId}/website`;
  const settings = useQuery<Settings>(path),
    inbox = useQuery<{ items: Enquiry[] }>(path + "/enquiries");
  const command = useCommand();
  const [draft, setDraft] = useState(""),
    [demo, setDemo] = useState(true),
    [version, setVersion] = useState<string | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (settings.data) {
      setDraft(JSON.stringify(settings.data.content, null, 2));
      setDemo(settings.data.demoEnabled);
      setVersion(settings.data.version);
      setSaved(false);
    }
  }, [settings.data]);
  if (settings.loading) return <p role="status">Loading website settings…</p>;
  if (!settings.data)
    return (
      <div>
        <p role="alert">{settings.error}</p>
        <Button onClick={() => settings.refresh()}>Retry</Button>
      </div>
    );
  async function save() {
    setError("");
    setSaved(false);
    let content: unknown;
    try {
      content = JSON.parse(draft);
    } catch {
      setError("Enter valid JSON before saving.");
      return;
    }
    const result = await command.run<Settings>(
      path,
      { version, demoEnabled: demo, content },
      true,
      "PUT",
    );
    if (result) {
      setVersion(result.version);
      setSaved(true);
    }
  }
  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">Swastikaa template</h2>
          <p className="text-sm text-muted-foreground">
            The hospital name, address and phone come from this clinic’s saved
            details. These settings apply when this template is deployed.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={demo}
            disabled={command.busy || command.unknown}
            onChange={(e) => {
              setDemo(e.target.checked);
              setSaved(false);
            }}
          />
          Keep sample doctors, schedules, plans and insurer names in demo mode
        </label>
        <p className="text-sm text-muted-foreground">
          Demo appointments and enquiries stay in the preview. Turn demo mode
          off to use published doctors, fees, sessions and the managed
          appointment assistant. Sample records are never added to clinical
          data.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => go("doctors")}>
            Doctors
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => go("schedules")}
          >
            Consultation hours
          </Button>
          <Button type="button" variant="outline" onClick={() => go("voice")}>
            Appointment assistant
          </Button>
        </div>
        <label className="block text-sm font-medium" htmlFor="website-content">
          Published website content (JSON)
        </label>
        <Textarea
          id="website-content"
          rows={14}
          spellCheck={false}
          className="font-mono text-xs"
          value={draft}
          disabled={command.busy || command.unknown}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
        />
        <p className="text-sm text-muted-foreground">
          Optional keys: logoUrl, heroImage, headline, introduction, story,
          photos, packages, services, treatments, scans, insurers and faqs.
          Media must use a local path or HTTPS. Empty lists remain empty in live
          mode. The server validates every field before publishing.
        </p>
        {(error || command.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || command.error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm">
            Website settings saved.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={command.busy || command.unknown}>
            {command.busy ? "Saving…" : "Save website settings"}
          </Button>
          {command.canReplay && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await command.replay<Settings>();
                if (result) {
                  setVersion(result.version);
                  setSaved(true);
                }
              }}
            >
              Recover original save
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={command.busy || command.unknown}
            onClick={() => settings.refresh()}
          >
            Reload saved settings
          </Button>
        </div>
      </form>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">General enquiries</h2>
          <Button variant="outline" onClick={() => inbox.refresh()}>
            Refresh inbox
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          The latest 100 website enquiries. Review records receipt only; it does
          not send a reply or make an appointment.
        </p>
        {inbox.error && <p role="alert">{inbox.error}</p>}
        {inbox.loading ? (
          <p role="status">Loading enquiries…</p>
        ) : inbox.data?.items.length === 0 ? (
          <p>No website enquiries received.</p>
        ) : (
          inbox.data?.items.map((item) => (
            <article key={item.id} className="space-y-2 border-b py-4">
              <div className="flex justify-between gap-4">
                <h3 className="font-medium">
                  {item.topic} · {item.name}
                </h3>
                <span className="text-sm">{item.status}</span>
              </div>
              <p className="text-sm">
                {item.email} · {new Date(item.createdAt).toLocaleString()}
              </p>
              {item.context && <p className="text-sm">{item.context}</p>}
              <p className="whitespace-pre-wrap text-sm">{item.message}</p>
              {item.status === "new" && (
                <Button
                  variant="outline"
                  disabled={command.busy || command.unknown}
                  onClick={async () => {
                    const result = await command.run(
                      path + "/enquiries/" + item.id + "/review",
                      { version: item.version },
                      true,
                    );
                    if (result) void inbox.refresh();
                  }}
                >
                  Mark reviewed
                </Button>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
