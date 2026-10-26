import { useState } from "react";
import {
  ChannelOnboardingSchema,
  ChannelOnboardingDraftSchema,
  type ChannelOnboardingDraft as AnyChannelOnboardingDraft,
} from "@hms/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkspaceChoice } from "@/components/WorkspaceChoice";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";
import { CommandReceiptRecovery } from "./CommandReceiptRecovery";
type Channel = "voice" | "whatsapp";
type ChannelOnboardingDraft = Exclude<AnyChannelOnboardingDraft, { channel: "apple_messages" }>;
const parseSetup = (value: unknown) => {
  const setup = ChannelOnboardingSchema.parse(value);
  // This existing form contains phone-number strategies for voice and WhatsApp only.
  if (setup.channel === "apple_messages" || setup.draft?.channel === "apple_messages")
    throw new Error("This setup form supports voice and WhatsApp.");
  return { ...setup, channel: setup.channel, draft: setup.draft };
};
const strategies = {
  voice: [
    ["existing_forwarded", "Keep clinic number · forward unanswered calls"],
    ["company_number", "New managed number · ring reception first"],
    ["existing_provider", "Use existing telephony account"],
  ],
  whatsapp: [
    ["company_number", "New company-managed number"],
    [
      "business_app_coexistence",
      "Keep WhatsApp Business app · eligibility check",
    ],
    ["existing_api", "Connect existing WhatsApp API number"],
    ["migrate_number", "Migrate an existing number · provider review"],
  ],
};
function defaults(channel: Channel): ChannelOnboardingDraft {
  return channel === "voice"
    ? {
        channel,
        numberStrategy: "existing_forwarded",
        existingNumber: null,
        receptionistNumber: "",
        languages: ["en"],
        greeting: "Hello, this is the clinic’s booking assistant.",
        overflow: {
          busy: true,
          noAnswer: true,
          unavailable: true,
          ringSeconds: 25,
        },
        humanTransferNumber: null,
        failureAction: "take_callback",
      }
    : {
        channel,
        numberStrategy: "company_number",
        existingNumber: null,
        languages: ["en"],
        greeting: "Hello! How can we help you with your appointment?",
        humanHandoff: "on_request",
      };
}
export function ChannelOnboarding({ channel }: { channel: Channel }) {
  const { facility, can } = useWorkspace();
  const q = useQuery(
    `/v1/channel-onboarding/${channel}?facilityId=${facility.facilityId}`,
    0,
    parseSetup,
  );
  return (
    <div className="space-y-4">
      {q.error && <p role="alert">{q.error}</p>}
      {q.loading && <p>Loading setup…</p>}
      {q.data && (
        <OnboardingForm
          key={`${facility.facilityId}:${channel}:${q.data.version}`}
          setup={q.data}
          canManage={can(channel === "voice" ? "voice.manage" : "comms.manage")}
          refresh={q.refresh}
        />
      )}
    </div>
  );
}
function OnboardingForm({
  setup,
  canManage,
  refresh,
}: {
  setup: ReturnType<typeof parseSetup>;
  canManage: boolean;
  refresh: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<ChannelOnboardingDraft>(
    setup.draft ?? defaults(setup.channel),
  );
  const [error, setError] = useState(""),
    [savedMessage, setSavedMessage] = useState("");
  const cmd = useCommand();
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(setup.draft ?? defaults(setup.channel));
  useUnsaved(dirty);
  const update = (values: Partial<ChannelOnboardingDraft>) => {
    setDraft({ ...draft, ...values } as ChannelOnboardingDraft);
    setSavedMessage("");
  };
  async function save() {
    const parsed = ChannelOnboardingDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(". "));
      return;
    }
    setError("");
    const result = await cmd.run(
      `/v1/channel-onboarding/${setup.channel}`,
      {
        facilityId: setup.facilityId,
        version: setup.version,
        draft: parsed.data,
      },
      true,
      "PUT",
    );
    if (result) {
      setSavedMessage("Preferences saved. Provider setup is still required.");
      await refresh();
    }
  }
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>
            {setup.channel === "voice" ? "Voice call setup" : "WhatsApp setup"}
          </CardTitle>
          <Badge variant="outline">
            {setup.state === "requested"
              ? "Setup requested"
              : setup.state === "draft"
                ? "Draft saved"
                : "Not started"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="font-medium">Managed by Exora</p>
        </div>
        <fieldset
          disabled={!canManage || cmd.busy || cmd.unknown}
          className="space-y-6"
        >
          <div className="space-y-2">
            <WorkspaceChoice label="Phone number" id="channel-number-plan" value={draft.numberStrategy}
              onChange={(numberStrategy) => update({ numberStrategy } as Partial<ChannelOnboardingDraft>)}
              options={strategies[setup.channel].map(([value, label]) => ({ value, label }))} />
            {draft.numberStrategy === "business_app_coexistence" && (
              <p className="text-muted-foreground">
                Keeping the Business app depends on Meta eligibility. Personal
                WhatsApp and API migrations need a separate review.
              </p>
            )}
            {draft.numberStrategy === "existing_forwarded" && (
              <p className="text-muted-foreground">
                Your carrier or PBX must support conditional forwarding. Our
                team will test busy, no-answer and unreachable behaviour with
                your clinic.
              </p>
            )}
          </div>
          {draft.numberStrategy !== "company_number" && (
            <div className="space-y-2">
              <Label htmlFor="channel-existing-number">
                Existing clinic number
              </Label>
              <Input
                id="channel-existing-number"
                placeholder="+919876543210"
                value={draft.existingNumber ?? ""}
                onChange={(e) =>
                  update({ existingNumber: e.target.value || null })
                }
              />
            </div>
          )}
          {draft.channel === "voice" && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="reception-number">Receptionist’s phone</Label>
                  <Input
                    id="reception-number"
                    placeholder="+919876543210"
                    value={draft.receptionistNumber}
                    onChange={(e) =>
                      update({ receptionistNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overflow-rings">
                    Ring reception for (seconds)
                  </Label>
                  <Input
                    id="overflow-rings"
                    type="number"
                    min={10}
                    max={90}
                    value={draft.overflow.ringSeconds}
                    onChange={(e) =>
                      update({
                        overflow: {
                          ...draft.overflow,
                          ringSeconds: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Route to the assistant when reception is</Label>
                <div className="flex gap-6">
                  {(["busy", "noAnswer", "unavailable"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.overflow[key]}
                        onChange={(e) =>
                          update({
                            overflow: {
                              ...draft.overflow,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {key === "noAnswer"
                        ? "Not answering"
                        : key === "unavailable"
                          ? "Unreachable"
                          : "Busy"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="human-transfer">
                  Alternate human transfer number · optional
                </Label>
                <Input
                  id="human-transfer"
                  placeholder="+919876543210"
                  value={draft.humanTransferNumber ?? ""}
                  onChange={(e) =>
                    update({ humanTransferNumber: e.target.value || null })
                  }
                />
                <p className="text-muted-foreground">
                  Use a staffed destination that will not forward back to the
                  assistant. If transfer fails, take a callback request.
                </p>
              </div>
            </>
          )}
          <div className="space-y-3">
            <Label>Assistant languages</Label>
            <div className="flex flex-wrap gap-5">
              {(
                [
                  ["en", "English"],
                  ["hi", "Hindi"],
                  ["kn", "Kannada"],
                  ["ta", "Tamil"],
                  ["te", "Telugu"],
                  ["ml", "Malayalam"],
                  ["mr", "Marathi"],
                  ["bn", "Bengali"],
                  ["gu", "Gujarati"],
                  ["pa", "Punjabi"],
                  ["od", "Odia"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.languages.includes(value)}
                    onChange={(e) =>
                      update({
                        languages: e.target.checked
                          ? [...draft.languages, value]
                          : draft.languages.filter((l) => l !== value),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground">
              Requested languages will be checked against the selected provider
              before activation.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-greeting">Assistant greeting</Label>
            <Textarea
              id="channel-greeting"
              rows={3}
              value={draft.greeting}
              onChange={(e) => update({ greeting: e.target.value })}
            />
          </div>
        </fieldset>
        {(error || cmd.error) && (
          <p role="alert" className="text-destructive">
            {error || cmd.error}
          </p>
        )}
        {savedMessage && <p role="status">{savedMessage}</p>}
        <CommandReceiptRecovery
          command={cmd}
          onConfirmed={() => void refresh()}
        />
        {canManage && (
          <div className="flex items-center gap-3 border-t pt-4">
            <Button
              onClick={() => void save()}
              disabled={
                (!dirty && setup.version > 0) || cmd.busy || cmd.unknown
              }
            >
              Save preferences
            </Button>
            <Button
              variant="outline"
              disabled={
                dirty ||
                !setup.version ||
                setup.state === "requested" ||
                cmd.busy ||
                cmd.unknown
              }
              onClick={async () => {
                const result = await cmd.run(
                  `/v1/channel-onboarding/${setup.channel}/submit`,
                  { facilityId: setup.facilityId, version: setup.version },
                  true,
                );
                if (result) await refresh();
              }}
            >
              Request setup
            </Button>
            <span className="text-muted-foreground">
              {dirty
                ? "Save before requesting setup."
                : setup.state === "requested"
                  ? "Our team still needs to configure and verify the provider."
                  : "Request setup after reviewing these preferences."}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
