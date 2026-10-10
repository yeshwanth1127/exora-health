import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  wa,
  assetUrl,
  dateTime,
  istDateTime,
  money,
  usable,
  type Asset,
  type Campaign,
  type Catalogue,
  type Config,
  type Preview,
  type StaffUser,
  type Template,
} from "@/lib/api";
import {
  Action,
  Choice,
  Empty,
  Field,
  Notice,
  Resource,
  SectionTitle,
  StateBadge,
  usePermissions,
  useResource,
} from "@/components/workspace";
import { UploadFile } from "@/modules/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Campaigns({
  user,
  config,
}: {
  user: StaffUser;
  config: Config;
}) {
  const canManage = usePermissions().can("campaigns.manage"),
    r = useResource<Campaign[]>(wa + "/campaigns"),
    templates = useResource<Template[]>(wa + "/templates"),
    catalogue = useResource<Catalogue>("/api/v1/admin/catalogue"),
    assets = useResource<Asset[]>(wa + "/campaign-assets"),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Campaign | null>(null),
    [pause, setPause] = useState<Campaign | null>(null),
    [copy, setCopy] = useState<Campaign | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [showTemplates, setShowTemplates] = useState(false);
  const visible =
    r.data?.filter(
      (c) =>
        (status === "all" || c.status === status) &&
        c.title.toLowerCase().includes(query.toLowerCase().trim()),
    ) ?? [];
  return (
    <Resource {...r}>
      <SectionTitle
        title="Campaigns"
        description="Choose a message, pick your audience, and check a phone test before scheduling."
        action={
          <Button
            disabled={!canManage}
            onClick={() => {
              setSelected(null);
              setCopy(null);
              setOpen(true);
            }}
          >
            <Plus /> Create campaign
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 items-end mb-5">
        <div className="flex-1 min-w-48">
          <Input
            aria-label="Search campaigns"
            placeholder="Find a campaign…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Choice
            label="Campaign status"
            value={status}
            onChange={setStatus}
            options={[
              ["all", "All campaigns"],
              ["draft", "Drafts"],
              ["scheduled", "Scheduled"],
              ["completed", "Completed"],
              ["paused", "Paused"],
            ]}
          />
        </div>
      </div>
      {visible.length ? (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.title}
                    <p className="font-normal text-xs text-muted-foreground mt-1">
                      {c.status === "draft"
                        ? "Proposed time"
                        : "Scheduled time"}{" "}
                      · {dateTime(c.scheduled_at)} IST
                    </p>
                  </TableCell>
                  <TableCell>
                    <StateBadge value={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.status === "draft"
                      ? "Not approved"
                      : `${c.approved_count} recipients`}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">
                      {(c.counts.delivered ?? 0) + (c.counts.read ?? 0)}{" "}
                      delivered · {c.bookings} bookings
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.engaged} button replies · {c.unsubscribes_from_buttons}{" "}
                      button opt-outs
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelected(c);
                          setCopy(null);
                          setOpen(true);
                        }}
                      >
                        {c.status === "draft"
                          ? "Continue draft"
                          : "View details"}
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelected(null);
                            setCopy(c);
                            setOpen(true);
                          }}
                        >
                          Use as starting point
                        </Button>
                      )}
                      {c.status === "scheduled" && (
                        <Button variant="ghost" onClick={() => setPause(c)}>
                          Pause
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Empty
          title={
            r.data?.length
              ? "No matching campaigns"
              : "Your first campaign starts with a draft"
          }
          description={
            r.data?.length
              ? "Try another status or campaign name."
              : "Choose an approved message, review it and check a test on your phone. Saving a draft sends nothing."
          }
        />
      )}
      <div className="mt-5 border-t pt-4">
        <Button
          variant="ghost"
          aria-expanded={showTemplates}
          onClick={() => setShowTemplates(!showTemplates)}
        >
          <FileText />
          {showTemplates ? "Hide" : "View"} message templates ·{" "}
          {templates.data?.length ?? 0}
        </Button>
        {showTemplates && (
          <div className="mt-4">
            <SectionTitle
              title="Message templates"
              description="Only supported templates approved by Meta and synced within two hours can be selected."
              action={
                <Button variant="outline" onClick={templates.refresh}>
                  <RefreshCw />
                  Refresh list
                </Button>
              }
            />
            <Resource {...templates}>
              {templates.data?.length ? (
                <Card className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Availability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.data.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {t.name}
                            <p className="text-xs text-muted-foreground mt-1 font-normal">
                              Last synced {dateTime(t.synced_at)}
                            </p>
                          </TableCell>
                          <TableCell>{t.category.toLowerCase()}</TableCell>
                          <TableCell>{t.language}</TableCell>
                          <TableCell>
                            <StateBadge
                              value={
                                usable(t)
                                  ? "ready"
                                  : t.status === "APPROVED"
                                    ? "needs sync"
                                    : t.status.toLowerCase()
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                <Empty
                  title="No templates synced yet"
                  description="Ask your administrator to connect the WhatsApp business account and sync Meta-approved templates."
                />
              )}
            </Resource>
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[960px] max-h-[90dvh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {selected?.status && selected.status !== "draft"
                ? "Campaign details"
                : selected
                  ? "Continue campaign"
                  : copy
                    ? "New campaign from a previous message"
                    : "Create a campaign"}
            </DialogTitle>
            <DialogDescription>
              Messages go out only after a checked test and audience approval.
            </DialogDescription>
          </DialogHeader>
          <Resource
            loading={[templates, catalogue, assets].some((v) => v.loading)}
            error={
              [templates, catalogue, assets].find((v) => v.error)?.error ?? ""
            }
            refresh={() => {
              templates.refresh();
              catalogue.refresh();
              assets.refresh();
            }}
          >
            {open && templates.data && catalogue.data && assets.data && (
              <Composer
                key={selected?.id ?? "new"}
                initial={selected}
                seed={copy}
                templates={templates.data}
                catalogue={catalogue.data}
                assets={assets.data}
                config={config}
                user={user}
                onDone={() => {
                  setOpen(false);
                  r.refresh();
                }}
                refreshAssets={assets.refresh}
              />
            )}
          </Resource>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pause}
        onOpenChange={(v) => {
          if (!v) setPause(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause {pause?.title}?</DialogTitle>
            <DialogDescription>
              Pending messages will be cancelled. Messages already sent cannot
              be recalled.
            </DialogDescription>
          </DialogHeader>
          <Action
            run={async () => {
              await api(`${wa}/campaigns/${pause!.id}/pause`, {
                method: "POST",
              });
              setPause(null);
              r.refresh();
            }}
            success="Campaign paused"
          >
            Pause campaign
          </Action>
        </DialogContent>
      </Dialog>
    </Resource>
  );
}
function Composer({
  initial,
  seed,
  templates,
  catalogue,
  assets,
  config,
  user,
  onDone,
  refreshAssets,
}: {
  initial: Campaign | null;
  seed: Campaign | null;
  templates: Template[];
  catalogue: Catalogue;
  assets: Asset[];
  config: Config;
  user: StaffUser;
  onDone: () => void;
  refreshAssets: () => void;
}) {
  const source = initial ?? seed;
  const available = templates.filter(
      (t) => usable(t) && t.category === "MARKETING",
    ),
    [step, setStep] = useState(initial ? 2 : 0),
    [draft, setDraft] = useState(initial),
    [title, setTitle] = useState(
      initial?.title ?? (seed ? `${seed.title.slice(0, 113)} (copy)` : ""),
    ),
    [templateId, setTemplateId] = useState(
      source?.template_id ?? available[0]?.id ?? "",
    ),
    [params, setParams] = useState(source?.parameters ?? []),
    [asset, setAsset] = useState(source?.asset_id ?? ""),
    [branch, setBranch] = useState(source?.audience.branch_id ?? ""),
    [interest, setInterest] = useState(source?.audience.interest ?? ""),
    [scheduled, setScheduled] = useState(
      initial ? istDateTime(new Date(initial.scheduled_at)) : istDateTime(),
    ),
    [rate, setRate] = useState(String((source?.rate_paise ?? 100) / 100)),
    [budget, setBudget] = useState(
      String((source?.budget_paise ?? 10000) / 100),
    ),
    [preview, setPreview] = useState<Preview | null>(null),
    [phone, setPhone] = useState(config.test_recipients[0] ?? ""),
    [received, setReceived] = useState(false),
    [testQueued, setTestQueued] = useState(false),
    [review, setReview] = useState(false),
    [loadError, setLoadError] = useState(""),
    [minimumTime] = useState(() => istDateTime(new Date()));
  const template = templates.find((t) => t.id === templateId),
    readonly = !!draft,
    body = template?.components.find((c) => c.type === "BODY")?.text ?? "",
    rendered = body.replace(
      /\{\{(\d+)\}\}/g,
      (_, n) => params[Number(n) - 1] || `[Field ${n}]`,
    ),
    header = template?.spec?.header,
    media = assets.find((a) => a.id === asset),
    changedTemplate = (id: string) => {
      setTemplateId(id);
      setParams([]);
      setAsset("");
    };
  useEffect(() => {
    if (initial)
      api<Preview>(`${wa}/campaigns/${initial.id}/preview`)
        .then(setPreview)
        .catch((e) => setLoadError(e.message));
  }, [initial]);
  const valid =
    title.trim().length >= 3 &&
    !!template &&
    usable(template) &&
    params.length === (template.spec?.parameters ?? 0) &&
    params.every((p) => p.trim().length > 0 && p.length <= 200) &&
    (!["IMAGE", "DOCUMENT"].includes(header ?? "") || !!asset);
  if (!available.length && !initial)
    return (
      <Empty
        title="An approved marketing template is needed first"
        description="Templates must be approved, supported and freshly synced from Meta. You can still manage doctor content and reception."
      />
    );
  const templateOptions =
    readonly && template && !available.some((t) => t.id === template.id)
      ? [...available, template]
      : available;
  return (
    <>
      <div
        className="flex gap-2 sm:gap-4 border-b pb-5 mb-5"
        aria-label="Campaign progress"
      >
        {["Message", "Audience", "Phone test", "Schedule"].map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 text-xs ${i === step ? "text-primary font-semibold" : "text-muted-foreground"}`}
          >
            <span
              className={`size-6 rounded-full flex items-center justify-center border ${i <= step ? "bg-muted border-border text-primary" : ""}`}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
            {i < 3 && <ArrowRight className="hidden sm:inline size-3 ml-1" />}
          </div>
        ))}
      </div>
      {loadError && (
        <Notice title="Draft details unavailable" text={loadError} />
      )}
      {draft && (
        <div className="mb-5 flex flex-wrap justify-between items-center gap-3 rounded-lg bg-muted/30 border p-3">
          <div>
            <p className="text-sm font-medium">{draft.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {draft.status === "draft" ? "Saved draft" : "Campaign"} ·{" "}
              {dateTime(draft.scheduled_at)} IST
            </p>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-7">
        <div className="space-y-5">
          {step === 0 && (
            <>
              <SectionTitle
                title="Choose your message"
                description="Use the exact wording Meta approved. Fill only the template’s editable fields."
              />
              <Field
                label="Campaign name"
                id="campaign-name"
                error={
                  title.trim().length < 3
                    ? "Enter a campaign name with at least 3 characters."
                    : undefined
                }
                hint="Internal name, visible only to your team."
              >
                <Input
                  id="campaign-name"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={readonly}
                  placeholder="October clinic update"
                />
              </Field>
              <Choice
                label="Approved marketing template"
                error={
                  !template || !usable(template)
                    ? "Select a supported, approved marketing template."
                    : undefined
                }
                value={templateId}
                onChange={changedTemplate}
                options={templateOptions.map((t) => [
                  t.id,
                  `${t.name.replaceAll("_", " ")} · ${t.language}`,
                ])}
                disabled={readonly}
              />
              {Array.from(
                { length: template?.spec?.parameters ?? 0 },
                (_, i) => (
                  <Field
                    key={i}
                    label={`Text for {{${i + 1}}}`}
                    id={`parameter-${i}`}
                    error={
                      !params[i]?.trim()
                        ? `Fill text for {{${i + 1}}} before continuing.`
                        : undefined
                    }
                    hint={`Fill this part of the message. See the live preview on the right.`}
                  >
                    <Input
                      id={`parameter-${i}`}
                      value={params[i] ?? ""}
                      maxLength={200}
                      onChange={(e) => {
                        const p = Array.from(
                          { length: template!.spec!.parameters },
                          (_, n) => params[n] ?? "",
                        );
                        p[i] = e.target.value;
                        setParams(p);
                      }}
                      disabled={readonly}
                    />
                  </Field>
                ),
              )}
              {["IMAGE", "DOCUMENT"].includes(header ?? "") && (
                <>
                  <Choice
                    label={header === "IMAGE" ? "Header image" : "Header PDF"}
                    error={
                      !asset
                        ? "Choose an uploaded file for the template header."
                        : undefined
                    }
                    value={asset}
                    onChange={setAsset}
                    options={[
                      ["", "Choose an uploaded file"],
                      ...assets
                        .filter((a) =>
                          header === "IMAGE"
                            ? a.mime_type.startsWith("image/")
                            : a.mime_type === "application/pdf",
                        )
                        .map((a) => [a.id, a.filename] as [string, string]),
                    ]}
                    disabled={readonly}
                  />
                  {!readonly && (
                    <UploadFile
                      label={header === "IMAGE" ? "Upload image" : "Upload PDF"}
                      accept={
                        header === "IMAGE"
                          ? "image/png,image/jpeg"
                          : "application/pdf"
                      }
                      onUpload={async (f) => {
                        const form = new FormData();
                        form.append("file", f);
                        const a = await api<Asset>(wa + "/campaign-assets", {
                          method: "POST",
                          body: form,
                        });
                        setAsset(a.id);
                        refreshAssets();
                      }}
                    />
                  )}
                </>
              )}
              {!valid && (
                <p className="text-xs text-muted-foreground">
                  {title.trim().length < 3
                    ? "Add a campaign name to continue."
                    : !template || !usable(template)
                      ? "Choose a freshly synced, approved template."
                      : ["IMAGE", "DOCUMENT"].includes(header ?? "") && !asset
                        ? "Choose the message attachment."
                        : "Fill every message field to continue."}
                </p>
              )}
              <Button disabled={!valid} onClick={() => setStep(1)}>
                Continue to audience
                <ArrowRight />
              </Button>
            </>
          )}
          {step === 1 && (
            <>
              <SectionTitle
                title="Audience & timing"
                description="Only patients who opted in to offers and match the template language are included."
              />
              <Choice
                label="Clinic"
                value={branch}
                onChange={setBranch}
                options={[
                  ["", "All clinics"],
                  ...catalogue.branches
                    .filter((b) => b.is_active)
                    .map((b) => [b.id, b.name] as [string, string]),
                ]}
                disabled={readonly}
              />
              <Choice
                label="Specialty interest"
                value={interest}
                onChange={setInterest}
                options={[
                  ["", "All specialties"],
                  ...catalogue.departments
                    .filter((d) => d.is_active)
                    .map((d) => [d.slug, d.name] as [string, string]),
                ]}
                disabled={readonly}
              />
              <Field
                label="Start sending"
                id="campaign-time"
                error={
                  !scheduled
                    ? "Choose when to start sending."
                    : !readonly && scheduled <= minimumTime
                      ? "Choose a future start time."
                      : undefined
                }
                hint="India Standard Time. Messages scheduled overnight wait until 9 am."
              >
                <Input
                  id="campaign-time"
                  type="datetime-local"
                  value={scheduled}
                  min={minimumTime}
                  onChange={(e) => setScheduled(e.target.value)}
                  disabled={readonly}
                />
              </Field>
              <details className="rounded-lg border p-4">
                <summary className="text-sm font-medium cursor-pointer">
                  Cost estimate · {money(Math.round(Number(budget) * 100) || 0)}{" "}
                  budget
                </summary>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <Field
                    label="Estimated cost per message (₹)"
                    id="campaign-rate"
                    error={
                      !Number.isFinite(Number(rate)) ||
                      Number(rate) < 0.01 ||
                      Number(rate) > 1000
                        ? "Enter a message cost from ₹0.01 to ₹1,000."
                        : undefined
                    }
                  >
                    <Input
                      id="campaign-rate"
                      type="number"
                      min={0.01}
                      max={1000}
                      step="0.01"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      disabled={readonly}
                    />
                  </Field>
                  <Field
                    label="Estimated budget (₹)"
                    id="campaign-budget"
                    error={
                      !Number.isFinite(Number(budget)) ||
                      Number(budget) < 0.01 ||
                      Number(budget) > 1000000
                        ? "Enter a budget from ₹0.01 to ₹10,00,000."
                        : undefined
                    }
                  >
                    <Input
                      id="campaign-budget"
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      disabled={readonly}
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  These are staff estimates, not a Meta billing cap. Actual
                  provider charges can differ.
                </p>
              </details>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Action
                  disabled={
                    !scheduled ||
                    (!readonly && scheduled <= minimumTime) ||
                    !Number.isFinite(Number(rate)) ||
                    Number(rate) < 0.01 ||
                    Number(rate) > 1000 ||
                    !Number.isFinite(Number(budget)) ||
                    Number(budget) < 0.01 ||
                    Number(budget) > 1000000
                  }
                  run={async () => {
                    if (draft) {
                      setStep(2);
                      return;
                    }
                    const c = await api<Campaign>(wa + "/campaigns", {
                      method: "POST",
                      body: {
                        title: title.trim(),
                        template_id: templateId,
                        parameters: params.map((p) => p.trim()),
                        asset_id: asset || null,
                        audience: {
                          branch_id: branch || undefined,
                          interest: interest || undefined,
                        },
                        scheduled_at: new Date(
                          `${scheduled}:00+05:30`,
                        ).toISOString(),
                        rate_paise: Math.round(Number(rate) * 100),
                        budget_paise: Math.round(Number(budget) * 100),
                      },
                    });
                    setDraft(c);
                    const p = await api<Preview>(
                      `${wa}/campaigns/${c.id}/preview`,
                    );
                    setPreview(p);
                    setStep(2);
                  }}
                  success="Draft saved. No message sent."
                >
                  Save draft & continue
                  <ArrowRight />
                </Action>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <SectionTitle
                title={
                  draft?.status === "draft"
                    ? "Check a test on your phone"
                    : "Campaign summary"
                }
                description={
                  draft?.status === "draft"
                    ? "Saving created a draft only. Send one test to a configured phone before approving patients."
                    : "This campaign has already been reviewed or paused."
                }
              />
              {draft?.status === "draft" ? (
                <>
                  <Choice
                    label="Test phone"
                    value={phone}
                    onChange={setPhone}
                    options={
                      config.test_recipients.length
                        ? config.test_recipients.map((n) => [n, `+${n}`])
                        : [["", "No test phone configured"]]
                    }
                    disabled={!config.test_recipients.length}
                    hint="This number must already be verified in Meta."
                  />
                  {!config.test_recipients.length && (
                    <Notice
                      title="No test phone configured"
                      text="Ask your administrator to add a verified test recipient before sending a test."
                    />
                  )}
                  <Action
                    disabled={!phone || !draft}
                    run={async () => {
                      await api(`${wa}/campaigns/${draft!.id}/test`, {
                        method: "POST",
                        body: { sender_id: phone, actor: user.name },
                      });
                      setTestQueued(true);
                    }}
                    success="Test queued. Wait for it to arrive in WhatsApp."
                  >
                    <Send />
                    Send one test
                  </Action>
                  {testQueued && (
                    <p className="text-xs text-muted-foreground">
                      Queued does not mean received. Check the selected phone
                      and Delivery history.
                    </p>
                  )}
                  <div className="flex items-start gap-3 pt-3">
                    <Checkbox
                      id="test-received"
                      checked={received}
                      onCheckedChange={(v) => setReceived(v === true)}
                    />
                    <Label htmlFor="test-received" className="leading-relaxed">
                      I received the test and checked the message, attachment
                      and buttons.
                    </Label>
                  </div>
                  <div className="flex flex-wrap justify-between gap-3 pt-4">
                    <Button variant="outline" onClick={onDone}>
                      Save for later
                    </Button>
                    <Action
                      disabled={!received || !!loadError}
                      run={async () => {
                        const p = await api<Preview>(
                          `${wa}/campaigns/${draft!.id}/preview`,
                        );
                        setPreview(p);
                        setStep(3);
                      }}
                    >
                      Review audience
                      <ArrowRight />
                    </Action>
                  </div>
                </>
              ) : (
                <>
                  <StateBadge value={draft?.status ?? "draft"} />
                  <p className="text-sm text-muted-foreground">
                    {draft?.approved_count ?? 0} approved recipients · Send
                    after {draft && dateTime(draft.scheduled_at)}
                  </p>
                  <Button variant="outline" onClick={onDone}>
                    Close details
                  </Button>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <SectionTitle
                title="Review before approval"
                description="This approval creates queued messages for the exact audience shown here."
              />
              {preview && (
                <Card className="bg-muted/30">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Consented recipients</span>
                      <strong>{preview.recipients}</strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Estimated cost</span>
                      <strong>{money(preview.estimated_cost_paise)}</strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Send after</span>
                      <strong>{draft && dateTime(draft.scheduled_at)}</strong>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Approved by {user.name} (@{user.username})
                    </div>
                  </CardContent>
                </Card>
              )}
              {!preview?.within_budget && (
                <Notice
                  title="Estimate exceeds the budget"
                  text="This draft cannot be approved. Create a revised draft with an appropriate budget."
                />
              )}
              {!config.outreach_enabled && (
                <Notice
                  title="Patient delivery is paused"
                  text="Your administrator must enable patient outreach before you approve this audience."
                />
              )}
              <div className="flex gap-3 items-start">
                <Checkbox
                  id="approve-audience"
                  checked={review}
                  onCheckedChange={(v) => setReview(v === true)}
                />
                <Label htmlFor="approve-audience" className="leading-relaxed">
                  I checked the message, attachment, audience and send time.
                </Label>
              </div>
              <Action
                variant="outline"
                run={async () =>
                  setPreview(
                    await api<Preview>(`${wa}/campaigns/${draft!.id}/preview`),
                  )
                }
              >
                Refresh audience
              </Action>
              <div className="flex flex-wrap justify-between gap-3 pt-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Action
                  disabled={
                    !review ||
                    !received ||
                    !preview?.within_budget ||
                    !config.outreach_enabled ||
                    !preview.recipients
                  }
                  run={async () => {
                    await api(`${wa}/campaigns/${draft!.id}/approve`, {
                      method: "POST",
                      body: {
                        actor: user.name,
                        test_received: true,
                        expected_count: preview!.recipients,
                        audience_hash: preview!.audience_hash,
                      },
                    });
                    onDone();
                  }}
                  success="Campaign approved and scheduled."
                >
                  <ShieldCheck />
                  Approve {preview?.recipients ?? 0} recipients
                </Action>
              </div>
            </>
          )}
        </div>
        <aside>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium">What the patient sees</h3>
            <Badge variant="outline">{template?.language ?? "—"}</Badge>
          </div>
          <div className="message-preview md:sticky md:top-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <span className="size-7 rounded-full bg-white flex items-center justify-center text-primary font-semibold">
                A
              </span>
              Avocado Health
            </div>
            <div className="message-bubble">
              {media && media.mime_type.startsWith("image/") ? (
                <img
                  src={assetUrl(media.id)}
                  alt="Campaign header image"
                  className="w-full rounded-lg mb-3"
                />
              ) : media ? (
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg mb-3">
                  <FileText className="size-4" />
                  {media.filename}
                </div>
              ) : header === "TEXT" ? (
                <strong className="block mb-2">
                  {template?.components.find((c) => c.type === "HEADER")?.text}
                </strong>
              ) : null}
              {preview?.body ?? rendered}
              {template?.components.find((c) => c.type === "FOOTER")?.text && (
                <p className="text-xs text-muted-foreground mt-3">
                  {template.components.find((c) => c.type === "FOOTER")?.text}
                </p>
              )}
              {template?.components
                .find((c) => c.type === "BUTTONS")
                ?.buttons?.map((b) => (
                  <div
                    key={b.text}
                    className="border-t border-border text-center text-primary mt-3 pt-2 text-xs"
                  >
                    {b.text}
                  </div>
                ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-3">
            Approximate layout; WhatsApp controls the final look. Saving or
            viewing this draft does not send a message.
          </p>
          {readonly && (
            <p className="text-xs text-muted-foreground mt-4">
              Saved drafts are fixed for review. To change the message or
              audience, create a new draft.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
