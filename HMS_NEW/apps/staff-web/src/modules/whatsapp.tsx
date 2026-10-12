import type { WhatsAppSettingsSchema } from "@hms/contracts";
import { useContext, useEffect, useRef, useState } from "react";
import { WorkspaceContext } from "@/hms/hooks";
import { clinicDateInput, clinicDateInstant } from "@/hms/notification-time";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  ImageIcon,
  MessageCircle,
  Search,
  Upload,
  Users,
  CalendarDays,
  Clock3,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  wa,
  dateTime,
  usable,
  type Asset,
  type Inventory,
  type Config,
  type Campaign,
  type Conversation,
  type Catalogue,
  type Template,
  type StaffUser,
  type Appointment,
  type Branch,
  localDate,
} from "@/lib/api";
import {
  Action,
  Choice,
  Empty,
  Field,
  Notice,
  PageTitle,
  Resource,
  SectionTitle,
  StateBadge,
  TaskLink,
  usePermissions,
  useApi,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Campaigns } from "@/modules/campaigns";
import { Conversations } from "@/modules/conversations";
import {
  PrivateAssetImage,
  PrivateAssetLink,
} from "@/components/private-asset";
import { NotificationDelivery } from "./whatsapp-notifications";

const pages = [
  ["overview", "Overview"],
  ["conversations", "Conversations"],
  ["content", "Doctor content"],
  ["campaigns", "Campaigns"],
  ["followups", "Follow-ups"],
  ["delivery", "Delivery history"],
  ["clinics", "Clinic details"],
];
export function WhatsAppModule({
  user,
  page,
  onNavigate,
  onAppointments,
  localNotifications = false,
}: {
  localNotifications?: boolean;
  user: StaffUser;
  page: string;
  onNavigate: (p: string) => void;
  onAppointments: () => void;
}) {
  const config = useResource<Config & { module_active?: boolean }>(
    wa + "/operations-config",
  );
  const supported = pages.map(([key]) => key);
  return (
    <>
      <PageTitle
        title="WhatsApp"
        description="Patient conversations and clinic outreach, in one place."
        action={
          <Button variant="outline" onClick={() => onNavigate("conversations")}>
            <MessageCircle />
            Open inbox
          </Button>
        }
      />
      <Tabs
        value={page}
        onValueChange={(v) => onNavigate(String(v))}
        className="module-tabs"
      >
        <TabsList>
          {pages
            .filter(([key]) => key !== "clinics" || user.role === "admin")
            .map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                disabled={localNotifications && !supported.includes(key)}
                title={
                  localNotifications && !supported.includes(key)
                    ? "This section is pending integration"
                    : undefined
                }
              >
                {label}
              </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>
      <Resource {...config}>
        {config.data && (
          <>
            {localNotifications ? (
              <Notice
                title="Local notification records · no messages are delivered"
                text="Inbox, content, campaigns and visit rules use saved local records. Automatic provider delivery is unavailable."
              />
            ) : (
              !config.data.outreach_enabled &&
              page !== "overview" && (
                <Notice
                  title="Patient outreach is paused"
                  text="You can prepare content and drafts. Patient campaigns, follow-ups and staff replies will send only after delivery is enabled by your administrator."
                />
              )
            )}
            {localNotifications && !supported.includes(page) ? (
              <Notice
                title="This section is pending integration"
                text="Its original design is retained. Use Overview, Follow-ups or Delivery history for the current local notification workflow."
              />
            ) : page === "overview" ? (
              <Overview
                config={config.data}
                go={onNavigate}
                onAppointments={onAppointments}
                localMode={localNotifications}
              />
            ) : page === "content" ? (
              <DoctorContent
                localMode={localNotifications}
                active={config.data.module_active !== false}
              />
            ) : page === "conversations" ? (
              <Conversations
                user={user}
                enabled={
                  localNotifications
                    ? config.data.module_active !== false
                    : config.data.outreach_enabled
                }
                localMode={localNotifications}
              />
            ) : page === "campaigns" ? (
              <Campaigns
                user={user}
                config={config.data}
                localMode={localNotifications}
                active={config.data.module_active !== false}
              />
            ) : page === "followups" ? (
              <Followups
                user={user}
                localNotifications={localNotifications}
                active={config.data.module_active !== false}
              />
            ) : page === "delivery" ? (
              localNotifications ? (
                <NotificationDelivery />
              ) : (
                <Delivery />
              )
            ) : page === "clinics" ? (
              user.role === "admin" ? (
                <ClinicDetails localMode={localNotifications} />
              ) : (
                <Notice
                  title="Administrator setting"
                  text="Only a clinic administrator can change clinic addresses, directions and arrival instructions."
                />
              )
            ) : (
              <Empty
                title="This page isn’t available"
                description="Choose a WhatsApp section above."
              />
            )}
          </>
        )}
      </Resource>
    </>
  );
}
function Overview({
  config,
  go,
  onAppointments,
  localMode = false,
}: {
  localMode?: boolean;
  config: Config;
  go: (p: string) => void;
  onAppointments: () => void;
}) {
  const localMetrics = (
    config as Config & {
      local_metrics?: {
        openConversations: number;
        campaignDrafts: number;
        marketingContacts: number;
      } | null;
    }
  ).local_metrics;
  const reception = useResource<Conversation[]>(
      localMode ? null : wa + "/reception",
    ),
    campaigns = useResource<Campaign[]>(wa + "/campaigns"),
    inventory = useResource<Inventory>("/api/v1/admin/whatsapp-assets"),
    templates = useResource<Template[]>(wa + "/templates");
  const loading = [reception, campaigns, inventory, templates].some(
      (r) => r.loading,
    ),
    error =
      [reception, campaigns, inventory, templates].find((r) => r.error)
        ?.error ?? "";
  const guides = inventory.data?.departments.filter((d) => d.guide).length ?? 0,
    photos = inventory.data?.doctors.filter((d) => d.photo).length ?? 0,
    drafts = campaigns.data?.filter((c) => c.status === "draft") ?? [],
    approved =
      templates.data?.filter((t) =>
        localMode
          ? (t as Template & { simulationOnly?: boolean }).simulationOnly ===
            true
          : usable(t),
      ) ?? [];
  return (
    <Resource
      loading={loading}
      error={error}
      refresh={() => {
        reception.refresh();
        campaigns.refresh();
        inventory.refresh();
        templates.refresh();
      }}
    >
      <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Today at your clinic
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Start with reception, then keep your booking content up to date.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            config.outreach_enabled
              ? "text-foreground"
              : "text-muted-foreground"
          }
        >
          <span
            className={`size-1.5 rounded-full ${config.outreach_enabled ? "bg-foreground" : "bg-slate-400"}`}
          />
          {config.outreach_enabled
            ? "Patient outreach enabled"
            : localMode
              ? "Provider delivery unavailable"
              : "Patient outreach paused"}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[
          {
            title: "Open conversations",
            value: localMode
              ? (localMetrics?.openConversations ?? "Unavailable")
              : (reception.data?.length ?? 0),
            note: localMode
              ? "Open staff contact threads"
              : "Patients with reception",
            icon: MessageCircle,
            page: "conversations",
          },
          {
            title: "Campaign drafts",
            value: localMode
              ? (localMetrics?.campaignDrafts ?? "Unavailable")
              : drafts.length,
            note: "Not sent to patients",
            icon: FileText,
            page: "campaigns",
          },
          {
            title: localMode ? "Marketing contacts" : "Offer subscribers",
            value: localMode
              ? (localMetrics?.marketingContacts ?? "Unavailable")
              : config.marketing_contacts,
            note: localMode
              ? "Distinct consented destinations"
              : "Patients who opted in",
            icon: Users,
            page: "campaigns",
          },
          {
            title: "Specialty guides",
            value: `${guides}/${inventory.data?.departments.length ?? 0}`,
            note: localMode
              ? "Private clinic content saved"
              : "PDFs ready for the bot",
            icon: Upload,
            page: "content",
          },
        ].map((m) => (
          <Card key={m.title} className="gap-0 p-0">
            <CardContent className="p-5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{m.title}</span>
                <m.icon className="size-4" />
              </div>
              <div className="text-3xl font-semibold tracking-tight mt-5 tabular-nums">
                {m.value}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">{m.note}</p>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Open ${m.title.toLowerCase()}`}
                  onClick={() => go(m.page)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-6">
          <Card className="gap-0 p-0">
            <CardHeader className="p-5 border-b">
              <CardTitle className="text-base">Your next steps</CardTitle>
              <CardDescription>
                Small tasks that keep the patient experience working.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TaskLink
                title={
                  (
                    localMode
                      ? localMetrics?.openConversations
                      : reception.data?.length
                  )
                    ? `${localMode ? localMetrics?.openConversations : reception.data?.length} conversations need reception`
                    : "Reception is up to date"
                }
                description={
                  (
                    localMode
                      ? localMetrics?.openConversations
                      : reception.data?.length
                  )
                    ? "Read the latest message, take ownership and reply."
                    : localMode
                      ? "Open a local support case for an existing contact, or review authenticated inbound events."
                      : "New handoffs will appear here when a patient asks for your team."
                }
                onClick={() => go("conversations")}
              />
              <TaskLink
                title="Complete doctor introductions"
                description={`${guides} specialty PDFs and ${photos} doctor portraits saved. Add or replace files in Doctor content.`}
                onClick={() => go("content")}
              />
              <TaskLink
                title={
                  approved.length
                    ? "Prepare your next campaign"
                    : "Set up approved messages"
                }
                description={
                  approved.length
                    ? `${approved.length} ${localMode ? "local content" : "current, supported"} templates available. Create a draft and test it before approval.`
                    : localMode
                      ? "Create local content before drafting a simulation. Provider approval is unavailable."
                      : "Approved templates must sync from Meta before you can create a campaign."
                }
                onClick={() => go("campaigns")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent campaign drafts
              </CardTitle>
              <CardDescription>
                Preparation only. Nothing sends when you save a draft.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drafts.length ? (
                <div className="space-y-3">
                  {drafts.slice(0, 3).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dateTime(d.scheduled_at)}
                        </p>
                      </div>
                      <StateBadge value={d.status} />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => go("campaigns")}
                  >
                    View campaigns
                    <ArrowRight />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No drafts yet. Start with an approved template when you’re
                  ready.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Before a patient message sends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                [
                  "Patient permission",
                  "Offers and visit messages have separate consent.",
                ],
                [
                  "Review, test, approve",
                  localMode
                    ? "Local campaigns need a reviewed simulation and a fixed consented audience."
                    : "Campaigns need a checked test and a fixed audience.",
                ],
                [
                  localMode ? "Local transport only" : "Respect their time",
                  localMode
                    ? "No messages are delivered. Quiet-hour and provider policies await live sending integration."
                    : "Messages wait overnight. Offers have frequency limits.",
                ],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground mt-1">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Appointments stay together
              </CardTitle>
              <CardDescription>
                WhatsApp bookings use the same appointment records as the rest
                of your clinic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={onAppointments}
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  Open appointment management
                </span>
                <ArrowRight />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Resource>
  );
}
export function UploadFile({
  label,
  accept,
  onUpload,
  compact = false,
  disabled = false,
}: {
  label: string;
  accept: string;
  onUpload: (file: File) => Promise<void>;
  compact?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const upload = async (file?: File) => {
    if (!file || busy || disabled) return;
    const image = accept.includes("image");
    if (file.size > (image ? 5 : 10) * 1024 * 1024) {
      toast.error(`Choose a file smaller than ${image ? 5 : 10} MB.`);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
      toast.success(
        "File uploaded. Saved content is available for future approved use.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <Card
      className={`${compact ? "border-none bg-transparent" : "border-dashed"} ${drag ? "bg-muted border-primary" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!busy && !disabled) void upload(e.dataTransfer.files[0]);
      }}
    >
      <CardContent className={compact ? "p-0" : "p-5 text-center"}>
        {!compact && (
          <>
            <Upload className="size-5 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs text-muted-foreground mb-3">
              Drag and drop a file here, or choose from your computer.
            </p>
          </>
        )}
        <Input
          ref={ref}
          type="file"
          accept={accept}
          aria-label={label}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button
          variant="outline"
          disabled={busy || disabled}
          onClick={() => ref.current?.click()}
        >
          <Upload />
          {busy ? "Uploading…" : label}
        </Button>
      </CardContent>
    </Card>
  );
}
async function uploadTo(
  api: ReturnType<typeof useApi>,
  path: string,
  file: File,
) {
  const body = new FormData();
  body.append("file", file);
  return api<Asset>(path, { method: "POST", body });
}
function DoctorContent({
  localMode = false,
  active = true,
}: {
  localMode?: boolean;
  active?: boolean;
}) {
  const api = useApi();
  const permissions = usePermissions();
  const resource = useResource<Inventory>("/api/v1/admin/whatsapp-assets"),
    [tab, setTab] = useState("guides"),
    [search, setSearch] = useState("");
  return (
    <Resource {...resource}>
      <SectionTitle
        title="Doctor content"
        description={
          localMode
            ? "Maintain private specialty PDFs and doctor portraits for approved clinic content. The booking bot is not enabled."
            : "The bot sends a specialty PDF before the doctor list, then shows the selected doctor’s portrait."
        }
      />
      <div className="flex flex-wrap gap-4 justify-between mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList>
            <TabsTrigger value="guides">Specialty PDFs</TabsTrigger>
            <TabsTrigger value="photos">Doctor portraits</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            aria-label="Search doctor content"
            placeholder={
              tab === "guides" ? "Find a specialty…" : "Find a doctor…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tab === "guides" ? "Specialty" : "Doctor"}</TableHead>
              <TableHead>Current file</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tab === "guides"
              ? resource.data?.departments
                  .filter((d) =>
                    d.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {d.name}
                        <p className="font-normal text-xs text-muted-foreground mt-1">
                          PDF · up to 10 MB
                        </p>
                      </TableCell>
                      <TableCell>
                        {d.guide ? (
                          <Button
                            variant="link"
                            render={<PrivateAssetLink id={d.guide.id} />}
                          >
                            <FileText />
                            {d.guide.filename}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">
                            No PDF uploaded
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          value={
                            d.guide
                              ? localMode
                                ? "local_validated"
                                : "ready"
                              : "missing"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <UploadFile
                            compact
                            disabled={
                              !permissions.can("comms.manage") || !active
                            }
                            label={
                              d.guide
                                ? `Replace ${d.name} PDF`
                                : `Upload ${d.name} PDF`
                            }
                            accept="application/pdf"
                            onUpload={async (f) => {
                              await uploadTo(
                                api,
                                `/api/v1/admin/departments/${d.id}/guide`,
                                f,
                              );
                              resource.refresh();
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              : resource.data?.doctors
                  .filter((d) =>
                    (d.name + " " + d.departments.join(" "))
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {d.photo ? (
                            <PrivateAssetImage
                              alt={`${d.name} portrait`}
                              className="size-10 rounded-lg object-cover"
                              id={d.photo.id}
                            />
                          ) : (
                            <div className="size-10 bg-muted rounded-lg flex items-center justify-center">
                              <ImageIcon className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="font-medium">
                            {d.name}
                            <p className="font-normal text-xs text-muted-foreground mt-1">
                              {d.departments.join(", ")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.photo?.filename ?? "No portrait uploaded"}
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          value={
                            d.photo
                              ? localMode
                                ? "local_validated"
                                : "ready"
                              : "missing"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <UploadFile
                            compact
                            disabled={
                              !permissions.can("comms.manage") || !active
                            }
                            label={
                              d.photo
                                ? `Replace ${d.name} portrait`
                                : `Upload ${d.name} portrait`
                            }
                            accept="image/png,image/jpeg"
                            onUpload={async (f) => {
                              await uploadTo(
                                api,
                                `/api/v1/admin/doctors/${d.id}/photo`,
                                f,
                              );
                              resource.refresh();
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
          </TableBody>
        </Table>
      </Card>
      {(tab === "guides"
        ? resource.data?.departments
        : resource.data?.doctors
      )?.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        .length === 0 && (
        <Empty
          title="No matches"
          description="Try a different doctor or specialty name."
        />
      )}
      <p className="text-xs text-muted-foreground mt-4">
        {localMode
          ? "Only use clinic-approved content. Files stay private; local validation does not prove production scanning or provider distribution."
          : "Only use clinic-approved content. Uploading a replacement affects future bot messages."}
      </p>
    </Resource>
  );
}
type Rule = {
  kind: string;
  enabled: boolean;
  template_id: string;
  delay_hours: number;
  version?: number;
};
const ruleNames: Record<string, [string, string]> = {
  feedback: ["Post-visit feedback", "After staff mark a visit completed"],
  no_show: [
    "Missed-visit rebooking",
    "After staff mark a patient as a no-show",
  ],
  followup: [
    "Doctor-requested follow-up",
    "After staff select a follow-up date for a completed visit",
  ],
  rescheduled: [
    "Visit moved by the clinic",
    "Sent straight away when staff reschedule a visit",
  ],
  cancelled: [
    "Visit cancelled by the clinic",
    "Sent straight away when staff cancel a visit",
  ],
};
const immediate = ["rescheduled", "cancelled", "reschedule", "cancellation"];
function Followups({
  user,
  localNotifications = false,
  active = true,
}: {
  user: StaffUser;
  localNotifications?: boolean;
  active?: boolean;
}) {
  const api = useApi();
  const workspace = useContext(WorkspaceContext);
  const timezone = workspace?.facility.timezone ?? "Asia/Kolkata";
  const instant = (value: string) =>
    localNotifications
      ? clinicDateInstant(value, timezone)
      : new Date(value).toISOString();
  const dueTime = (value: string) => {
    try {
      return Date.parse(instant(value));
    } catch {
      return NaN;
    }
  };
  const names: Record<string, [string, string]> = localNotifications
    ? {
        day_before: ["Day-before reminder", "Before a confirmed visit"],
        same_day: [
          "Same-day reminder",
          "Before a confirmed visit on the same clinic day",
        ],
        follow_up: [
          "Doctor-requested follow-up",
          "Staff choose a contact date for a completed visit",
        ],
        reschedule: ["Visit moved by the clinic", "After staff reschedule a visit"],
        cancellation: ["Visit cancelled by the clinic", "After staff cancel a visit"],
        feedback: ["Post-visit feedback", "After a persisted completed visit"],
        no_show: [
          "Missed-visit rebooking",
          "After staff mark a visit as no-show",
        ],
      }
    : ruleNames;
  const followupKind = localNotifications ? "follow_up" : "followup";
  const canSchedule = usePermissions().can(
    localNotifications ? "comms.reply" : "followups.manage",
  );
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const canManage = usePermissions().can("followups.manage"),
    rules = useResource<Rule[]>(wa + "/followup-rules"),
    templates = useResource<Template[]>(
      localNotifications ? null : wa + "/templates",
    ),
    visits = useResource<Appointment[]>(
      "/api/v1/admin/appointments?status=completed",
    ),
    [edit, setEdit] = useState<Rule | null>(null),
    [visit, setVisit] = useState(""),
    [due, setDue] = useState(() =>
      localNotifications
        ? clinicDateInput(new Date(Date.now() + 3600000), timezone)
        : localDate(),
    ),
    [confirm, setConfirm] = useState(false);
  const options =
    templates.data
      ?.filter(
        (t) =>
          usable(t) &&
          t.spec?.parameters === 3 &&
          [null, "TEXT"].includes(t.spec.header) &&
          t.category !== "AUTHENTICATION",
      )
      .map((t) => [t.id, `${t.name} · ${t.language}`] as [string, string]) ??
    [];
  return (
    <Resource {...rules}>
      <SectionTitle
        title="Visit follow-ups"
        description={
          localNotifications
            ? "Local reminder and requested follow-up records. No messages are delivered."
            : "Care messages follow recorded visit events. Patient consent is checked again before delivery."
        }
      />
      {notice && <Notice title="Follow-up recorded" text={notice} />}
      {localNotifications && (
        <p className="mb-4 text-xs text-muted-foreground">
          These controls save consented local reminder rules. Feedback and
          missed-visit records follow authoritative visit events; no provider
          templates are approved or sent.
        </p>
      )}
      <Card className="p-0 mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purpose</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(names).map(([kind, [name, trigger]]) => {
              const rule = rules.data?.find((r) => r.kind === kind);
              return (
                <TableRow key={kind}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {trigger}
                  </TableCell>
                  <TableCell>
                    <StateBadge value={rule?.enabled ? "enabled" : "off"} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      disabled={!canManage || (localNotifications && !active)}
                      onClick={() =>
                        setEdit(
                          rule ?? {
                            kind,
                            enabled: false,
                            template_id: options[0]?.[0] ?? "",
                            delay_hours: immediate.includes(kind) ? 0 : 24,
                          },
                        )
                      }
                    >
                      Configure
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Schedule a doctor-requested follow-up
            </CardTitle>
            <CardDescription>
              {localNotifications
                ? "Choose a completed visit from the last 180 clinic days and the requested contact date. Up to 500 visits are listed; older visits are not shown."
                : "Choose a completed visit and the requested contact date."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Resource {...visits}>
              <Choice
                label="Completed visit"
                value={visit}
                onChange={setVisit}
                options={[
                  ["", "Select a completed visit"],
                  ...(visits.data
                    ?.filter(
                      (a) =>
                        localNotifications || a.origin_channel === "whatsapp",
                    )
                    .map(
                      (a) =>
                        [
                          a.id,
                          `${a.patient_name} · ${a.confirmation_code}`,
                        ] as [string, string],
                    ) ?? []),
                ]}
              />
            </Resource>
            <Field
              label="Contact date and time"
              id="followup-date"
              error={
                !due || !Number.isFinite(dueTime(due))
                  ? "Choose a contact date and time."
                  : dueTime(due) <= now
                    ? "Choose a contact time in the future."
                    : dueTime(due) > now + 180 * 86400000
                      ? "Choose a contact date within the next 180 days."
                      : undefined
              }
              hint={
                localNotifications
                  ? `${timezone} clinic time. Choose within the next 180 days.`
                  : "Your computer’s local time. Choose within the next 180 days."
              }
            >
              <Input
                type="datetime-local"
                id="followup-date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                min={
                  localNotifications
                    ? clinicDateInput(new Date(now), timezone)
                    : localDate(new Date(now))
                }
              />
            </Field>
            <Button
              disabled={
                !canSchedule ||
                (localNotifications && !active) ||
                !visit ||
                !due ||
                !Number.isFinite(dueTime(due)) ||
                dueTime(due) <= now ||
                dueTime(due) > now + 180 * 86400000 ||
                !rules.data?.find((r) => r.kind === followupKind)?.enabled
              }
              onClick={() => setConfirm(true)}
            >
              <Clock3 />
              Review follow-up
            </Button>
            {!rules.data?.find((r) => r.kind === followupKind)?.enabled && (
              <p className="text-xs text-muted-foreground">
                Configure and enable the doctor-requested rule first.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">
              A visit message is not medical advice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              {localNotifications
                ? "Use clinic-approved administrative wording. An administrative reminder does not prescribe treatment or decide when a patient needs clinical follow-up."
                : "Use clinic-approved administrative wording. The bot does not prescribe treatment or decide when a patient needs clinical follow-up."}
            </p>
            <p>
              {localNotifications
                ? "Reminder and follow-up scheduling requires explicit messaging consent. Campaign preparation and approval are available as local simulations."
                : "Patients must opt in to visit messages. Templates classified as marketing also need offer consent."}
            </p>
            <p>
              {localNotifications
                ? "Current consent, visit status and expiry are checked by the local worker. Provider delivery and quiet-hour controls remain pending."
                : "Quiet hours and current appointment status are checked at delivery."}
            </p>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit && names[edit.kind][0]}</DialogTitle>
            <DialogDescription>
              {localNotifications
                ? "This rule creates local notification records. No provider template is approved or sent."
                : "Template fields must be booking reference, doctor name and visit time, in that order."}
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-5">
              {!localNotifications && (
                <Resource {...templates}>
                  <Choice
                    label="Approved template"
                    value={edit.template_id}
                    onChange={(v) => setEdit({ ...edit, template_id: v })}
                    options={
                      options.length
                        ? options
                        : [["", "No compatible template available"]]
                    }
                  />
                </Resource>
              )}
              {!immediate.includes(edit.kind) &&
                !(localNotifications && edit.kind === "follow_up") && (
                  <Field
                    label={
                      localNotifications &&
                      ["day_before", "same_day"].includes(edit.kind)
                        ? "Hours before the visit"
                        : "Delay after the visit event (hours)"
                    }
                    id="rule-delay"
                  >
                    <Input
                      id="rule-delay"
                      type="number"
                      min={0}
                      max={720}
                      value={edit.delay_hours}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          delay_hours: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                )}
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="rule-enabled" className="text-sm">
                  {localNotifications
                    ? "Enable consented local scheduling"
                    : "Enable consented messages"}
                </Label>
                <Switch
                  id="rule-enabled"
                  checked={edit.enabled}
                  onCheckedChange={(v) => setEdit({ ...edit, enabled: v })}
                />
              </div>
              <Action
                disabled={
                  !canManage ||
                  (localNotifications
                    ? !active ||
                      !Number.isInteger(edit.delay_hours) ||
                      edit.delay_hours < 0 ||
                      edit.delay_hours > 720
                    : !edit.template_id)
                }
                run={async () => {
                  await api(`${wa}/followup-rules/${edit.kind}`, {
                    method: "PUT",
                    body: {
                      ...(localNotifications
                        ? { version: edit.version ?? 0 }
                        : {}),
                      enabled: edit.enabled,
                      template_id: edit.template_id,
                      delay_hours: edit.delay_hours,
                    },
                  });
                  setEdit(null);
                  rules.refresh();
                }}
                success="Follow-up rule saved"
              >
                Save rule
              </Action>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule this follow-up?</DialogTitle>
            <DialogDescription>
              {visits.data?.find((v) => v.id === visit)?.patient_name} ·{" "}
              {visits.data?.find((v) => v.id === visit)?.confirmation_code}
              <br />
              {due && Number.isFinite(dueTime(due))
                ? localNotifications
                  ? new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: timezone,
                    }).format(new Date(instant(due)))
                  : dateTime(instant(due))
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {localNotifications
              ? "This records a follow-up after checking visit status and consent. It does not deliver a message."
              : "This queues the approved template. It sends only if patient permission and delivery settings allow it."}
          </p>
          <Action
            disabled={
              !canSchedule ||
              (localNotifications && !active) ||
              !Number.isFinite(dueTime(due))
            }
            run={async () => {
              const result = await api<{ status?: string; reason?: string }>(
                `${wa}/appointments/${visit}/followup`,
                {
                  method: "POST",
                  body: {
                    ...(!localNotifications ? { actor: user.name } : {}),
                    due_at: instant(due),
                  },
                },
              );
              if (localNotifications)
                setNotice(
                  result.status === "skipped_no_consent"
                    ? "Not scheduled for sending: the selected contact has no applicable consent. No message was delivered."
                    : "Saved as a local notification record. No message was delivered.",
                );
              setConfirm(false);
              setVisit("");
            }}
            success={localNotifications ? undefined : "Follow-up scheduled"}
          >
            Schedule follow-up
          </Action>
        </DialogContent>
      </Dialog>
    </Resource>
  );
}
type Job = {
  id: string;
  sender_id: string;
  purpose: string;
  status: string;
  due_at: string;
  last_error?: string;
  meta_message_id?: string;
};
function Delivery() {
  const r = useResource<Job[]>(wa + "/outbound"),
    issues = useResource<{
      inbound: { message_id: string; status: string; attempts: number }[];
      reminders: { id: string; status: string; attempts: number }[];
    }>("/api/v1/admin/whatsapp-delivery-issues"),
    [filter, setFilter] = useState("all");
  return (
    <Resource {...r}>
      <SectionTitle
        title="Delivery history"
        description="Accepted means Meta accepted the request. Delivered and read require provider updates."
        action={
          <Button
            variant="outline"
            onClick={() => {
              r.refresh();
              issues.refresh();
            }}
          >
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <div className="mb-5 max-w-xs">
        <Choice
          label="Message status"
          value={filter}
          onChange={setFilter}
          options={[
            "all",
            "pending",
            "accepted",
            "delivered",
            "read",
            "failed",
            "uncertain",
            "cancelled",
          ].map((v) => [
            v,
            v === "all"
              ? "All statuses"
              : v.replace(/^./, (c) => c.toUpperCase()),
          ])}
        />
      </div>
      {r.data?.some((j) => j.status === "uncertain") && (
        <Notice
          title="Some messages need manual review"
          text="An uncertain message may already have been sent. Check the provider record before taking any further action; it is never retried automatically."
        />
      )}
      {r.data?.filter((j) => filter === "all" || j.status === filter).length ? (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Send after</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data
                .filter((j) => filter === "all" || j.status === filter)
                .map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>+{j.sender_id}</TableCell>
                    <TableCell>{j.purpose.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateTime(j.due_at)}
                    </TableCell>
                    <TableCell>
                      <StateBadge value={j.status} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Empty
          title="No matching messages"
          description="Queued reception replies, campaigns and follow-ups will appear here."
        />
      )}
      <Resource {...issues}>
        {!!(issues.data?.inbound.length || issues.data?.reminders.length) && (
          <div className="mt-6">
            <SectionTitle
              title="Booking replies & reminder issues"
              description="These use separate queues. Check the provider before resending an uncertain message."
            />
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...(issues.data?.inbound ?? []).map((j) => ({
                      ...j,
                      id: j.message_id,
                    })),
                    ...(issues.data?.reminders ?? []),
                  ].map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">
                        {j.id}
                      </TableCell>
                      <TableCell>
                        <StateBadge value={j.status} />
                      </TableCell>
                      <TableCell>{j.attempts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </Resource>
    </Resource>
  );
}
function ClinicDetails({ localMode = false }: { localMode?: boolean }) {
  const api = useApi();
  const canManage = usePermissions().can("clinics.manage");
  const catalogue = useResource<Catalogue>("/api/v1/admin/catalogue"),
    [edit, setEdit] = useState<Branch | null>(null);
  return (
    <Resource {...catalogue}>
      {localMode && <LocalWhatsAppSettings />}
      <SectionTitle
        title="Clinic details"
        description="Administrator setting · booking confirmations use these addresses, directions and arrival instructions."
      />
      <div className="grid md:grid-cols-2 gap-5">
        {catalogue.data?.branches.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex-row justify-between items-start">
              <div>
                <CardTitle className="text-base">{b.name}</CardTitle>
                <CardDescription className="mt-1">{b.area}</CardDescription>
              </div>
              <StateBadge value={b.is_active ? "active" : "inactive"} />
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground min-h-10">
                {b.address || "Address not added yet."}
              </p>
              {b.arrival_instructions && (
                <p className="text-xs text-muted-foreground">
                  {b.arrival_instructions}
                </p>
              )}
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={!canManage}
                  onClick={() => setEdit(b)}
                >
                  Edit details
                </Button>
                {b.directions_url && (
                  <Button
                    variant="link"
                    render={
                      <a
                        href={b.directions_url}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    View directions
                    <ArrowRight />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit clinic details</DialogTitle>
            <DialogDescription>{edit?.name}</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-5">
              <Field label="Address" id="clinic-address">
                <Textarea
                  id="clinic-address"
                  value={edit.address}
                  maxLength={500}
                  onChange={(e) =>
                    setEdit({ ...edit, address: e.target.value })
                  }
                />
              </Field>
              <Field label="Google Maps directions link" id="clinic-map">
                <Input
                  id="clinic-map"
                  type="url"
                  value={edit.directions_url}
                  maxLength={500}
                  onChange={(e) =>
                    setEdit({ ...edit, directions_url: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Arrival instructions"
                id="clinic-arrival"
                hint="For example, arrive 10 minutes early and bring prior reports."
              >
                <Textarea
                  id="clinic-arrival"
                  value={edit.arrival_instructions}
                  maxLength={500}
                  onChange={(e) =>
                    setEdit({ ...edit, arrival_instructions: e.target.value })
                  }
                />
              </Field>
              <Action
                run={async () => {
                  await api(`${wa}/branches/${edit.id}`, {
                    method: "PATCH",
                    body: {
                      address: edit.address,
                      directions_url: edit.directions_url,
                      arrival_instructions: edit.arrival_instructions,
                    },
                  });
                  setEdit(null);
                  catalogue.refresh();
                }}
                success="Clinic details saved"
              >
                Save details
              </Action>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Resource>
  );
}

function LocalWhatsAppSettings() {
  const api = useApi(),
    canManage = usePermissions().can("comms.manage"),
    settings = useResource<(typeof WhatsAppSettingsSchema)["_output"]>(
      `${wa}/settings`,
    );
  const [phone, setPhone] = useState("");
  return (
    <Resource {...settings}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">WhatsApp callback account</CardTitle>
          <CardDescription>
            Server-scoped routing for verified inbound events. This does not
            activate provider delivery or a booking bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.data && (
            <>
              <p className="text-xs text-muted-foreground">
                Signed callback account:{" "}
                {settings.data.webhookReady ? "Configured" : "Unavailable"} ·
                Provider sending: unavailable · Production content scan/storage:{" "}
                {settings.data.storageReady
                  ? "Local development storage"
                  : "Unconfigured"}
              </p>
              {canManage && (
                <>
                  <Field
                    label="Provider phone-number ID"
                    id="wa-phone-id"
                    hint="Account identifier only. Credentials remain on the server."
                  >
                    <Input
                      id="wa-phone-id"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="numeric"
                      placeholder={settings.data.phoneNumberId ?? ""}
                      maxLength={40}
                    />
                  </Field>
                  <Action
                    disabled={!/^\d{5,40}$/.test(phone)}
                    run={async () => {
                      await api(`${wa}/settings`, {
                        method: "PUT",
                        body: {
                          phoneNumberId: phone,
                          version: settings.data!.version,
                        },
                      });
                      setPhone("");
                      settings.refresh();
                    }}
                    success="Callback routing saved. No provider sending activated."
                  >
                    Save callback account
                  </Action>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Resource>
  );
}
