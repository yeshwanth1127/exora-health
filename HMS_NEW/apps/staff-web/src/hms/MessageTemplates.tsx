import { useEffect, useState } from "react";
import {
  WhatsAppSettingsSchema,
  MessageTemplatesResponseSchema,
  MessageTemplateSchema,
  TemplateProviderStatusCheckSchema,
  TemplateProviderStatusResultSchema,
  TemplateSubmissionSchema,
  TemplateSubmissionInputSchema,
  TemplateSubmissionResultSchema,
} from "@hms/contracts";
import { HmsError, request } from "./client";
import type { MutationTransport } from "./operational-intent";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceChoice } from "@/components/WorkspaceChoice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace, useQuery } from "./hooks";
import { useRecoverableCommand } from "./operational-command";
import { RecoveryNotice } from "./OperationalRecovery";
import { Field, ErrorMessage } from "./ui";
import { requestLeave, useUnsaved } from "./leave";

type ProviderStatusCheck = ReturnType<
  typeof TemplateProviderStatusCheckSchema.parse
>;
export function TemplateMetaStatus({
  check,
  version,
  timezone = "UTC",
}: {
  check?: ProviderStatusCheck | null;
  version: number;
  timezone?: string;
}) {
  if (!check)
    return (
      <span className="text-sm text-muted-foreground">
        Not checked with Meta
      </span>
    );
  const stale = check.localVersion !== version;
  const approved =
    !stale && check.match === "exact" && check.status === "APPROVED";
  const label =
    check.match === "missing"
      ? "Not found in Meta"
      : approved
        ? "Meta approved · current draft matches"
        : `Meta: ${check.status ?? "Status unavailable"}`;
  return (
    <div className="space-y-1">
      <Badge variant={approved ? "secondary" : "outline"}>{label}</Badge>
      {stale && (
        <p className="text-sm text-muted-foreground">
          Draft changed since last check
        </p>
      )}
      {check.match === "different" && (
        <p className="text-sm text-muted-foreground">
          Draft differs from Meta; resubmission needed
        </p>
      )}
      {check.match === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Provider format needs review
        </p>
      )}
      {!stale && check.match === "exact" && !approved && (
        <p className="text-sm text-muted-foreground">
          Current draft matches Meta
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Checked{" "}
        <time dateTime={check.checkedAt}>
          {new Date(check.checkedAt).toLocaleString("en-IN", {
            timeZone: timezone,
            timeZoneName: "short",
          })}
        </time>
      </p>
    </div>
  );
}
type Submission = ReturnType<typeof TemplateSubmissionSchema.parse>;
export function TemplateSubmissionStatus({
  submission,
}: {
  submission?: Submission | null;
}) {
  if (!submission) return null;
  const labels: Record<Submission["state"], string> = {
    queued: "Submission queued",
    dispatching: "Submitting to Meta",
    submitted: "Submitted to Meta",
    uncertain: "Submission outcome unconfirmed",
    failed: "Submission failed",
    conflict: "Provider revision conflict",
    cancelled: "Submission cancelled",
  };
  const reasons: Record<string, string> = {
    provider_result_unknown: "Meta’s creation response was not confirmed.",
    worker_result_missing: "The worker stopped before its result was recorded.",
    provider_result_not_found: "This revision was not found in the latest Meta check.",
    provider_content_conflict: "Meta’s content differs from this submitted revision.",
    provider_read_unavailable: "Meta status is temporarily unavailable.",
    provider_validation_rejected: "Meta rejected the template details. Review the draft before submitting again.",
    requester_authority_withdrawn: "The requesting staff member no longer has messaging access.",
    module_inactive: "WhatsApp was disabled before the submission started.",
    provider_binding_changed: "The clinic’s connected account changed. Review the original account.",
  };
  return (
    <div className="mt-3 space-y-1 text-sm">
      <Badge variant="outline">{labels[submission.state]}</Badge>
      <p className="break-all text-muted-foreground">
        Meta name: {submission.providerName}
      </p>
      {submission.providerStatus && <p>Meta: {submission.providerStatus}</p>}
      {!submission.currentDraftMatches && (
        <p className="text-muted-foreground">
          Draft changed since this submission
        </p>
      )}
      {submission.reason && (
        <p className="text-muted-foreground">{reasons[submission.reason] ?? "This submission needs review."}</p>
      )}
      {submission.state === "uncertain" && (
        <p className="text-muted-foreground">
          Check Meta status to reconcile this submission. Do not submit it
          again.
        </p>
      )}
    </div>
  );
}
function submissionBlock(row: Template) {
  if (row.header !== "none")
    return "Only templates without a header can be submitted here.";
  if (row.body.length > 1024)
    return "Shorten the message to 1,024 characters before submitting.";
  if (
    row.submission?.currentDraftMatches &&
    ["queued", "dispatching", "uncertain", "conflict", "submitted"].includes(
      row.submission.state,
    )
  )
    return "This draft already has a submission. Check Meta status for its result.";
  return undefined;
}
function decodeSettings(value: unknown) {
  const parsed = WhatsAppSettingsSchema.safeParse(value);
  if (!parsed.success)
    throw new HmsError(
      "The WhatsApp account status could not be verified. Refresh before checking Meta.",
      502,
      "invalid_response",
    );
  return parsed.data;
}
type Template = ReturnType<typeof MessageTemplateSchema.parse>;
function decodeTemplates(value: unknown) {
  const parsed = MessageTemplatesResponseSchema.safeParse(value);
  if (!parsed.success)
    throw new HmsError(
      "The template list could not be verified. Refresh before continuing.",
      502,
      "invalid_response",
    );
  return parsed.data;
}
export const templateTransport: MutationTransport = async (path, options) => {
  const raw = await request<unknown>(path, options);
  if (path.endsWith("/submissions")) {
    const parsed = TemplateSubmissionResultSchema.safeParse(raw);
    const reviewed = TemplateSubmissionInputSchema.safeParse(options.body);
    if (
      !parsed.success ||
      !reviewed.success ||
      path !== `/v1/message-templates/${parsed.data.templateId}/submissions` ||
      parsed.data.version !== reviewed.data.version + 1 ||
      parsed.data.submission.templateId !== parsed.data.templateId ||
      parsed.data.submission.facilityId !== reviewed.data.facilityId ||
      parsed.data.submission.templateVersion !== reviewed.data.version ||
      JSON.stringify(parsed.data.submission.samples) !==
        JSON.stringify(reviewed.data.samples) ||
      parsed.data.submission.parameterCount !== reviewed.data.samples.length ||
      !parsed.data.submission.providerName.trim()
    )
      throw new HmsError(
        "The Meta submission could not be verified. Recover the original request before continuing.",
        502,
        "outcome_unknown",
      );
    return parsed.data;
  }
  if (!path.endsWith("/provider-status")) return raw;
  const parsed = TemplateProviderStatusResultSchema.safeParse(raw);
  const reviewedVersion = (options.body as { version?: unknown } | undefined)
    ?.version;
  if (
    !parsed.success ||
    path !==
      `/v1/message-templates/${parsed.data.templateId}/provider-status` ||
    typeof reviewedVersion !== "number" ||
    parsed.data.version !== reviewedVersion + 1 ||
    (parsed.data.match === "missing"
      ? parsed.data.providerStatus !== null ||
        parsed.data.providerTemplateId !== null
      : !parsed.data.providerStatus?.trim() ||
        !parsed.data.providerTemplateId?.trim())
  )
    throw new HmsError(
      "The Meta status check could not be verified. Recover the original request before continuing.",
      502,
      "outcome_unknown",
    );
  return parsed.data;
};
type Form = Pick<
  Template,
  "name" | "body" | "language" | "category" | "parameterCount" | "header"
>;
const empty: Form = {
  name: "",
  body: "",
  language: "en",
  category: "utility",
  parameterCount: 0,
  header: "none",
};
function bodyError(body: string, count: number) {
  const matches = [...body.matchAll(/\{\{([1-9][0-9]*)\}\}/g)].map((m) =>
    Number(m[1]),
  );
  return /[{}]/.test(body.replace(/\{\{([1-9][0-9]*)\}\}/g, "")) ||
    matches.some((n) => n > count) ||
    new Set(matches).size !== count
    ? "Use {{1}}, {{2}} and so on, without gaps. The parameter count must match."
    : "";
}
export function MessageTemplates() {
  const { me, facility, can } = useWorkspace();
  const [pollMs, setPollMs] = useState(0);
  const list = useQuery<{ items: Template[] }>(
    can("comms.read")
      ? `/v1/message-templates?facilityId=${facility.facilityId}`
      : null,
    pollMs,
    decodeTemplates,
  );
  const settings = useQuery(
    can("comms.manage")
      ? `/v1/comms/settings?facilityId=${facility.facilityId}`
      : null,
    0,
    decodeSettings,
  );
  const command = useRecoverableCommand(
    templateTransport,
    `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
  );
  const [editor, setEditor] = useState<Template | "new" | null>(null),
    [form, setForm] = useState<Form>(empty),
    [initial, setInitial] = useState(""),
    [submitted, setSubmitted] = useState(false),
    [review, setReview] = useState<Template | null>(null),
    [samples, setSamples] = useState<string[]>([]),
    [fictional, setFictional] = useState(false),
    [submissionAttempted, setSubmissionAttempted] = useState(false);

  const pending = command.busy || command.unknown;
  const checkUnavailable = settings.error
    ? "Could not verify the connected account. Refresh and try again."
    : settings.loading
      ? "Checking account configuration…"
      : !settings.data?.providerConfigured ||
          !settings.data.templateStatusAvailable
        ? "Connect this clinic’s WhatsApp account to check Meta status."
        : undefined;
  const submitUnavailable = settings.error
    ? "Could not verify the connected account. Refresh and try again."
    : settings.loading
      ? "Checking account configuration…"
      : !settings.data?.templateSubmissionAvailable
        ? "Meta submission is unavailable. Connect this clinic’s account and enable template submission."
        : undefined;
  const dirty =
    (editor !== null && JSON.stringify(form) !== initial) ||
    (!!review && (fictional || samples.some((sample) => !!sample.trim())));
  useEffect(() => {
    setPollMs(
      !editor &&
        !review &&
        !pending &&
        list.data?.items.some(
          (row) =>
            row.submission &&
            ["queued", "dispatching"].includes(row.submission.state),
        )
        ? 5000
        : 0,
    );
  }, [editor, review, pending, list.data]);
  useUnsaved(dirty, { pending });
  const open = (row: Template | "new") => {
    const value =
      row === "new"
        ? { ...empty }
        : {
            name: row.name,
            body: row.body,
            language: row.language,
            category: row.category,
            parameterCount: row.parameterCount,
            header: row.header,
          };
    setEditor(row);
    setForm(value);
    setInitial(JSON.stringify(value));
    setSubmitted(false);
  };
  const close = () => {
    setEditor(null);
    setReview(null);
    setSamples([]);
    setFictional(false);
    setSubmissionAttempted(false);
    setSubmitted(false);
    void list.refresh();
  };
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  const invalid =
    form.name.trim().length < 2 ||
    form.body.trim().length < 3 ||
    form.language.trim().length < 2 ||
    !Number.isInteger(form.parameterCount) ||
    form.parameterCount < 0 ||
    form.parameterCount > 10 ||
    !!bodyError(form.body, form.parameterCount);
  if (!can("comms.read"))
    return (
      <ErrorMessage text="Your account cannot view messaging templates at this clinic." />
    );
  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">WhatsApp templates</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pending || !!editor || !!review}
            onClick={() => {
              void list.refresh();
              void settings.refresh();
            }}
          >
            <RefreshCw />
            Refresh
          </Button>
          {can("comms.manage") && (
            <Button
              disabled={pending || !!editor || !!review}
              onClick={() => open("new")}
            >
              <Plus />
              New template
            </Button>
          )}
        </div>
      </div>
      <ErrorMessage text={list.error} />
      <ErrorMessage text={command.error} />
      <RecoveryNotice command={command} onRecovered={close} />
      {review ? (
        <Card>
          <CardHeader>
            <CardTitle>Review submission to Meta</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubmissionAttempted(true);
                if (
                  pending ||
                  !fictional ||
                  samples.length !== review.parameterCount ||
                  samples.some(
                    (sample) => !sample.trim() || sample.trim().length > 200,
                  ) ||
                  submitUnavailable ||
                  submissionBlock(review)
                )
                  return;
                const receipt = await command.run(
                  `/v1/message-templates/${review.id}/submissions`,
                  {
                    facilityId: facility.facilityId,
                    version: review.version,
                    samples: samples.map((sample) => sample.trim()),
                    fictionalExamples: true,
                  },
                  true,
                );
                if (receipt) close();
              }}
            >
              <fieldset disabled={pending} className="space-y-5">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Local name</dt>
                    <dd className="mt-1 font-medium">{review.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reviewed draft</dt>
                    <dd className="mt-1">Version {review.version}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Language</dt>
                    <dd className="mt-1">{review.language}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Meta category</dt>
                    <dd className="mt-1">{review.category.toUpperCase()}</dd>
                  </div>
                </dl>
                <div className="rounded-md border bg-muted/30 p-4">
                  <h3 className="font-medium">Message submitted for review</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {review.body}
                  </p>
                </div>
                {!!review.parameterCount && (
                  <div className="space-y-3">
                    <h3 className="font-medium">
                      Fictional parameter examples
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Use invented examples, such as “Alex Example”. Do not
                      include patient data.
                    </p>
                    {samples.map((sample, index) => (
                      <Field
                        key={index}
                        title={`Example for {{${index + 1}}}`}
                        id={`meta-sample-${index}`}
                      >
                        <Input
                          id={`meta-sample-${index}`}
                          value={sample}
                          maxLength={200}
                          required
                          onChange={(event) =>
                            setSamples((previous) =>
                              previous.map((value, position) =>
                                position === index ? event.target.value : value,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={fictional}
                    onChange={(event) => setFictional(event.target.checked)}
                    required
                  />
                  <span>
                    I confirm the examples are fictional and contain no patient
                    information.
                  </span>
                </label>
                {submissionAttempted &&
                  (!fictional || samples.some((sample) => !sample.trim())) && (
                    <ErrorMessage text="Add a fictional example for every parameter and confirm no patient information is included." />
                  )}
              </fieldset>
              <div className="flex gap-3">
                <Button type="submit" disabled={pending || !!submitUnavailable}>
                  {command.busy
                    ? "Queueing submission…"
                    : "Submit to Meta review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => requestLeave(() => setReview(null))}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : editor ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editor === "new" ? "New template" : "Edit template"}
            </CardTitle>
            <CardDescription>
              Saved changes are local drafts. They are not sent or submitted to
              Meta for approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitted(true);
                if (invalid || pending) return;
                const body = {
                  ...form,
                  name: form.name.trim(),
                  body: form.body.trim(),
                  language: form.language.trim(),
                  facilityId: facility.facilityId,
                  ...(editor === "new" ? {} : { version: editor.version }),
                };
                const saved = await command.run(
                  editor === "new"
                    ? "/v1/message-templates"
                    : `/v1/message-templates/${editor.id}`,
                  body,
                  true,
                  editor === "new" ? "POST" : "PATCH",
                );
                if (saved) close();
              }}
            >
              <fieldset disabled={pending} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Field title="Template name" id="template-name">
                    <Input
                      id="template-name"
                      value={form.name}
                      maxLength={80}
                      required
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </Field>
                  <Field title="Language code" id="template-language">
                    <Input
                      id="template-language"
                      value={form.language}
                      maxLength={12}
                      placeholder="en or hi"
                      required
                      onChange={(e) => set("language", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <Field title="Purpose" id="template-category">
                    <WorkspaceChoice id="template-category" label="Category" value={form.category}
                      onChange={(value) => set("category", value as Form["category"])}
                      options={[{ value: "utility", label: "Appointment updates" }, { value: "marketing", label: "Marketing" }]} />
                  </Field>
                  <Field title="Header" id="template-header">
                    <WorkspaceChoice id="template-header" label="Header" value={form.header}
                      onChange={(value) => set("header", value as Form["header"])}
                      options={[{ value: "none", label: "No header" }, { value: "text", label: "Text" }, { value: "image", label: "Image" }]} />
                  </Field>
                  <Field title="Number of parameters" id="template-parameters">
                    <Input
                      id="template-parameters"
                      type="number"
                      min={0}
                      max={10}
                      value={form.parameterCount}
                      onChange={(e) =>
                        set("parameterCount", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <Field title="Message" id="template-body">
                  <Textarea
                    id="template-body"
                    className="min-h-40"
                    maxLength={3000}
                    value={form.body}
                    required
                    onChange={(e) => set("body", e.target.value)}
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use numbered placeholders such as {"{{1}}"} for a patient’s
                    name. Repeat a placeholder when needed.
                  </p>
                </Field>
                {submitted && invalid && (
                  <ErrorMessage
                    text={
                      bodyError(form.body, form.parameterCount) ||
                      "Enter a name, language and message before saving."
                    }
                  />
                )}
                <div className="rounded-md border bg-muted/30 p-4">
                  <h3 className="font-medium">Draft preview</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {form.body || "Your message will appear here."}
                  </p>
                </div>
              </fieldset>
              <div className="flex gap-3">
                <Button type="submit" disabled={pending}>
                  {command.busy ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => requestLeave(() => setEditor(null))}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {list.loading ? (
              <p className="text-muted-foreground">Loading templates…</p>
            ) : !list.data?.items.length ? (
              <div className="py-8">
                <h3 className="font-medium">No templates yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a draft for appointment updates or a campaign.
                </p>
              </div>
            ) : (
              <Table className="table-fixed [&_td]:align-top [&_td]:whitespace-normal">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Template</TableHead>
                    <TableHead className="w-[14%]">Purpose</TableHead>
                    <TableHead className="w-[8%]">Language</TableHead>
                    <TableHead className="w-[12%]">Local draft</TableHead>
                    <TableHead className="w-[18%]">Meta status</TableHead>
                    <TableHead className="w-[18%]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="break-words font-medium">
                          {row.name}
                        </span>
                        <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                          {row.body}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.category === "utility"
                          ? "Appointment updates"
                          : "Marketing"}
                      </TableCell>
                      <TableCell>{row.language}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Local draft</Badge>
                      </TableCell>
                      <TableCell>
                        <TemplateMetaStatus
                          check={row.providerStatusCheck}
                          version={row.version}
                          timezone={facility.timezone}
                        />
                        <TemplateSubmissionStatus submission={row.submission} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {can("comms.manage") &&
                            (row.editable ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending || !!list.error}
                                onClick={() => open(row)}
                              >
                                Edit
                              </Button>
                            ) : (
                              <span
                                className="text-sm text-muted-foreground"
                                title={row.editBlockedReason ?? undefined}
                              >
                                Campaign content locked
                              </span>
                            ))}
                          {can("comms.manage") && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                pending ||
                                !!editor ||
                                !!list.error ||
                                !!checkUnavailable
                              }
                              title={checkUnavailable}
                              onClick={async () => {
                                const checked = await command.run(
                                  `/v1/message-templates/${row.id}/provider-status`,
                                  {
                                    facilityId: facility.facilityId,
                                    version: row.version,
                                  },
                                  true,
                                );
                                if (checked) void list.refresh();
                              }}
                            >
                              Check Meta status
                            </Button>
                          )}
                          {can("comms.manage") && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                pending ||
                                !!list.error ||
                                !!submitUnavailable ||
                                !!submissionBlock(row)
                              }
                              title={submitUnavailable ?? submissionBlock(row)}
                              onClick={() => {
                                setReview(structuredClone(row));
                                setSamples(
                                  Array.from(
                                    { length: row.parameterCount },
                                    () => "",
                                  ),
                                );
                                setFictional(false);
                                setSubmissionAttempted(false);
                              }}
                            >
                              Review submission
                            </Button>
                          )}
                        </div>
                        {can("comms.manage") && submissionBlock(row) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {submissionBlock(row)}
                          </p>
                        )}
                        {can("comms.manage") &&
                          submitUnavailable &&
                          !checkUnavailable && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {submitUnavailable}
                            </p>
                          )}
                        {can("comms.manage") && checkUnavailable && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {checkUnavailable}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
