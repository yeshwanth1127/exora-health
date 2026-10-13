// Hospital catalogue: the clinics this user can access, and the selected clinic's details, departments,
// bookable services (with their default fee) and consult rooms. Everything shown can be changed here by
// someone holding the permission at this clinic: facility.manage (clinic details, departments, rooms),
// catalog.manage (services) and pricing.manage (fees). The API enforces each; buttons only follow it.
import { useState, type ReactNode } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageTitle } from "@/components/workspace";
import { request } from "./client";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { label, money, today } from "./model";
import { requestLeave, useUnsaved } from "./leave";
import {
  CODE,
  E164,
  PINCODE,
  changedFields,
  isStale,
  minorToRupees,
  refusal,
  rupeesToMinor,
} from "./forms";
import {
  Choice,
  Empty,
  ErrorMessage,
  Field,
  Hint,
  LoadingState,
  Status,
} from "./ui";
import { clinicCode, stateChoices, validTimezone } from "./clinic-location";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import type {
  ClinicDirectory,
  ConsultRoom,
  Department,
  Facility,
  FacilityDetail,
  HealthcareService,
  PriceBookItem,
  Specialty,
} from "./types";

type Editing =
  | { kind: "clinic"; detail: FacilityDetail | null }
  | { kind: "department"; row: Department | null }
  | { kind: "service"; row: HealthcareService | null }
  | { kind: "room"; row: ConsultRoom | null };

const REASONS: Record<string, string> = {
  stale_version:
    "Someone else saved this first. Close the form and open it again to see their change.",
  in_use:
    "It is still in use. Change what uses it first (services, doctors or weekly hours).",
  future_appointments:
    "Visits are still booked here. Move or cancel them first.",
  published_hours:
    "Doctors still have weekly hours here. End those hours first in Schedules.",
  last_facility: "The hospital needs at least one active clinic.",
  duplicate_code: "That code is already used. Choose another.",
};

/** The fee booking would charge for a service today: its own any-mode price. */
const defaultFee = (items: PriceBookItem[], serviceId: string, on: string) =>
  items.find(
    (i) =>
      i.healthcareServiceId === serviceId &&
      i.staffId === null &&
      i.mode === "any" &&
      i.validFrom <= on &&
      (!i.validTo || i.validTo > on),
  );

export function Catalogue() {
  const { me, facility, practitioners, can } = useWorkspace();
  const at = facility.facilityId;
  const day = today(facility.timezone);
  const manageClinic = can("facility.manage"),
    manageServices = can("catalog.manage"),
    pricing = can("pricing.manage");
  const everywhere = (me.permissions["facility.manage"] ?? []).includes("*");
  const facilities = useQuery<{ items: Facility[] }>(
    `/v1/facilities${everywhere ? "?includeInactive=true" : ""}`,
  );
  const detail = useQuery<FacilityDetail>(`/v1/facilities/${at}`);
  const directory = useQuery<ClinicDirectory>(
    `/v1/facilities/${at}/directory?includeInactive=${manageClinic || manageServices}`,
  );
  const prices = useQuery<{ items: PriceBookItem[] }>(
    `/v1/facilities/${at}/price-book?on=${day}`,
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const refresh = () => {
    void facilities.refresh();
    void detail.refresh();
    void directory.refresh();
    void prices.refresh();
  };
  const departments = directory.data?.departments ?? [];
  const deptName = (id: string | null) =>
    departments.find((d) => d.departmentId === id)?.name ?? "—";
  // The directory names a doctor's department, so doctors are matched to this clinic's departments by name.
  const doctorsIn = (d: Department) =>
    practitioners.filter((p) => p.department === d.name).length;
  return (
    <>
      <PageTitle
        title="Hospital catalogue"
        description="Clinic locations, departments, services and rooms available to patients and agents."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw />
              Refresh
            </Button>
            {everywhere && (
              <Button
                onClick={() => setEditing({ kind: "clinic", detail: null })}
              >
                <Plus />
                Add clinic
              </Button>
            )}
          </div>
        }
      />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Clinic branches</CardTitle>
            <CardDescription>
              {facilities.data?.items.length ?? 0} locations. Switch clinic at
              the top to manage another.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingState {...facilities}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(facilities.data?.items ?? []).map((f) => (
                    <TableRow key={f.facilityId}>
                      <TableCell>
                        {f.name}
                        {f.facilityId === at && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            · selected
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {f.city ?? ""} {label(f.facilityType)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Status value={f.status ?? "active"} />
                      </TableCell>
                      <TableCell>
                        {f.status === "inactive" && everywhere && (
                          <Reactivate
                            facilityId={f.facilityId}
                            onDone={refresh}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </LoadingState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{facility.name}</CardTitle>
              <CardDescription>
                What patients and booking channels are told about this clinic.
              </CardDescription>
            </div>
            {manageClinic && detail.data && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditing({ kind: "clinic", detail: detail.data })
                }
              >
                <Pencil />
                Edit details
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <LoadingState {...detail}>
              {detail.data && <ClinicSummary d={detail.data} />}
            </LoadingState>
          </CardContent>
        </Card>
      </div>
      <LoadingState {...directory}>
        <Section
          title="Departments"
          description={`${departments.length} departments with their doctors at this clinic.`}
          add={
            manageClinic
              ? () => setEditing({ kind: "department", row: null })
              : undefined
          }
          addLabel="Add department"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Doctors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.departmentId}>
                  <TableCell>
                    {d.name}
                    <p className="text-xs text-muted-foreground">
                      {d.code} · {label(d.kind)}
                    </p>
                  </TableCell>
                  <TableCell>{d.specialtyName ?? "—"}</TableCell>
                  <TableCell>{doctorsIn(d)}</TableCell>
                  <TableCell>
                    <Status value={d.status} />
                  </TableCell>
                  <TableCell>
                    {manageClinic && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditing({ kind: "department", row: d })
                        }
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!departments.length && (
            <WorkspaceEmpty
              title="Add a department"
              description="Departments group your doctors and services."
              action={
                manageClinic
                  ? {
                      label: "Add department",
                      onClick: () =>
                        setEditing({ kind: "department", row: null }),
                    }
                  : undefined
              }
            />
          )}
        </Section>
        <Section
          title="Bookable services"
          description="What patients book, by visit type, with the default consultation fee. Doctors can have their own fee (Doctors page)."
          add={
            manageServices && departments.some((d) => d.status === "active")
              ? () => setEditing({ kind: "service", row: null })
              : undefined
          }
          addLabel="Add service"
        >
          {prices.error && (
            <div className="mb-4">
              <ErrorMessage text="We couldn't load consultation fees. Service details remain available; missing prices are not confirmed." />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void prices.refresh()}
              >
                Retry fees
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Visit type</TableHead>
                <TableHead>Default fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(directory.data?.services ?? []).map((s) => {
                const fee = defaultFee(
                  prices.data?.items ?? [],
                  s.healthcareServiceId,
                  day,
                );
                return (
                  <TableRow key={s.healthcareServiceId}>
                    <TableCell>
                      {s.name}
                      <p className="text-xs text-muted-foreground">
                        {s.code} · {s.defaultDurationMin} min
                        {s.isPublic ? "" : " · staff only"}
                      </p>
                    </TableCell>
                    <TableCell>{deptName(s.departmentId)}</TableCell>
                    <TableCell>
                      {s.serviceMode === "both"
                        ? "In person and video"
                        : s.serviceMode === "virtual"
                          ? "Video"
                          : "In person"}
                    </TableCell>
                    <TableCell className="whitespace-normal max-w-56">
                      {prices.loading ? (
                        "Checking fee…"
                      ) : prices.error || !prices.data ? (
                        "Fee unavailable"
                      ) : fee ? (
                        money(fee.feeMinor)
                      ) : prices.data.items.some(
                          (p) =>
                            p.healthcareServiceId === s.healthcareServiceId &&
                            p.staffId === null &&
                            p.validFrom <= day &&
                            (!p.validTo || p.validTo > day),
                        ) ? (
                        "Mode-specific fee"
                      ) : (
                        <div className="space-y-2">
                          <p>No default consultation fee</p>
                          <p className="text-xs text-muted-foreground">
                            Confirm an applicable fee before booking;
                            doctor-specific fees may apply.
                          </p>
                          {pricing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditing({ kind: "service", row: s })
                              }
                            >
                              Set fee
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Status value={s.status} />
                    </TableCell>
                    <TableCell>
                      {(manageServices || pricing) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditing({ kind: "service", row: s })
                          }
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!directory.data?.services.length && (
            <WorkspaceEmpty
              title="Create a consultation patients can book"
              description={
                departments.length
                  ? "Choose a department, visit type, duration and fee."
                  : "Add a department first, then create its consultation and fee."
              }
              action={
                departments.length && manageServices
                  ? {
                      label: "Add service",
                      onClick: () => setEditing({ kind: "service", row: null }),
                    }
                  : manageClinic && !departments.length
                    ? {
                        label: "Add department",
                        onClick: () =>
                          setEditing({ kind: "department", row: null }),
                      }
                    : undefined
              }
            />
          )}
        </Section>
        <Section
          title="Consult rooms"
          description="Rooms doctors see patients in."
          add={
            manageClinic
              ? () => setEditing({ kind: "room", row: null })
              : undefined
          }
          addLabel="Add room"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(directory.data?.consultRooms ?? []).map((r) => (
                <TableRow key={r.locationId}>
                  <TableCell>
                    {r.name}
                    <p className="text-xs text-muted-foreground">{r.code}</p>
                  </TableCell>
                  <TableCell>{deptName(r.departmentId)}</TableCell>
                  <TableCell>
                    <Status value={r.status} />
                  </TableCell>
                  <TableCell>
                    {manageClinic && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ kind: "room", row: r })}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!directory.data?.consultRooms.length && (
            <Empty>No consult rooms yet.</Empty>
          )}
        </Section>
      </LoadingState>
      {!manageClinic && !manageServices && (
        <p className="mt-4 text-xs text-muted-foreground">
          Read-only: a clinic administrator changes these details.
        </p>
      )}
      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) requestLeave(() => setEditing(null));
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {editing?.kind === "clinic" && (
            <ClinicForm
              detail={editing.detail}
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
          {editing?.kind === "department" && (
            <DepartmentForm
              row={editing.row}
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
          {editing?.kind === "service" && (
            <ServiceForm
              row={editing.row}
              departments={departments.filter(
                (d) =>
                  d.status === "active" ||
                  d.departmentId === editing.row?.departmentId,
              )}
              fee={
                editing.row
                  ? defaultFee(
                      prices.data?.items ?? [],
                      editing.row.healthcareServiceId,
                      day,
                    )
                  : undefined
              }
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
          {editing?.kind === "room" && (
            <RoomForm
              row={editing.row}
              departments={departments}
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Section({
  title,
  description,
  add,
  addLabel,
  children,
}: {
  title: string;
  description: string;
  add?: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {add && (
          <Button variant="outline" size="sm" onClick={add}>
            <Plus />
            {addLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ClinicSummary({ d }: { d: FacilityDetail }) {
  const address = [
    d.addressLine1,
    d.addressLine2,
    d.city,
    d.district,
    d.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const rows: [string, ReactNode][] = [
    ["Address", address || "Not recorded"],
    ["Phone", d.phone ?? "Not recorded"],
    ["Email", d.email ?? "Not recorded"],
    [
      "Directions",
      d.directionsUrl ? (
        <a
          key="directions"
          className="underline"
          href={d.directionsUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Map link
        </a>
      ) : (
        "Not recorded"
      ),
    ],
    ["Arrival instructions", d.arrivalInstructions ?? "Not recorded"],
    ["Type · time zone", `${label(d.facilityType)} · ${d.timezone}`],
    ["Status", <Status key="s" value={d.status} />],
  ];
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="col-span-2 whitespace-pre-line">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Reactivate({
  facilityId,
  onDone,
}: {
  facilityId: string;
  onDone: () => void;
}) {
  const cmd = useCommand();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={cmd.busy}
        onClick={async () => {
          const d = await request<FacilityDetail>(
            `/v1/facilities/${facilityId}`,
          ).catch(() => null);
          if (!d) return;
          if (
            await cmd.run(
              `/v1/facilities/${facilityId}`,
              { version: d.version, status: "active" },
              false,
              "PATCH",
            )
          )
            onDone();
        }}
      >
        Switch on
      </Button>
      <ErrorMessage text={cmd.error} />
    </>
  );
}

/** Explains a refusal by its reason code, else shows the server's message. */
function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const reason = refusal(cmd.failure);
  return (
    <ErrorMessage
      text={
        (reason && REASONS[reason]) ||
        (isStale(cmd.failure) ? REASONS.stale_version : cmd.error)
      }
    />
  );
}

function StatusSwitch({
  id,
  active,
  onChange,
  disabled,
}: {
  id: string;
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>Active</Label>
      <Switch
        id={id}
        checked={active}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

const FACILITY_TYPES = [
  "hospital",
  "clinic",
  "diagnostic_centre",
  "pharmacy",
  "virtual",
];

function ClinicForm({
  detail,
  onSaved,
}: {
  detail: FacilityDetail | null;
  onSaved: () => void;
}) {
  const cmd = useCommand();
  const start = {
    code: detail?.code ?? "",
    name: detail?.name ?? "",
    facilityType: detail?.facilityType ?? "clinic",
    addressLine1: detail?.addressLine1 ?? "",
    addressLine2: detail?.addressLine2 ?? "",
    city: detail?.city ?? "",
    district: detail?.district ?? "",
    pincode: detail?.pincode ?? "",
    stateCode: detail?.stateCode ?? "",
    phone: detail?.phone ?? "",
    email: detail?.email ?? "",
    timezone: detail?.timezone ?? "Asia/Kolkata",
    directionsUrl: detail?.directionsUrl ?? "",
    arrivalInstructions: detail?.arrivalInstructions ?? "",
    active: (detail?.status ?? "active") === "active",
  };
  const [f, setF] = useState(start);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [codeEdited, setCodeEdited] = useState(false),
    [customState, setCustomState] = useState(false);
  const set = (k: keyof typeof start) => (v: string | boolean) =>
    setF((x) => ({ ...x, [k]: v }));
  const { code, active, ...fields } = f;
  const changes = detail
    ? {
        ...changedFields(detail, fields),
        ...(active !== (detail.status === "active")
          ? { status: active ? "active" : "inactive" }
          : {}),
      }
    : null;
  useUnsaved(
    detail
      ? Object.keys(changes!).length > 0
      : Object.keys(f).some(
          (k) => f[k as keyof typeof f] !== start[k as keyof typeof start],
        ),
    { pending: cmd.busy || cmd.unknown },
  );
  const issues = [
    {
      field: "name",
      message: f.name.trim().length < 2 && "Enter the clinic name.",
    },
    {
      field: "code",
      message:
        !detail &&
        !CODE.test(code) &&
        "Use a short code of letters, digits, _ or -.",
    },
    {
      field: "stateCode",
      message:
        !/^[0-9]{2}$/.test(f.stateCode) &&
        "Select the clinic’s state; other stored state codes use two digits.",
    },
    {
      field: "timezone",
      message: !validTimezone(f.timezone) && "Select a valid time zone.",
    },
    {
      field: "pincode",
      message:
        f.pincode && !PINCODE.test(f.pincode) && "A pincode is 6 digits.",
    },
    {
      field: "phone",
      message:
        f.phone &&
        !E164.test(f.phone) &&
        "Use the international phone format, e.g. +918012345678.",
    },
    {
      field: "directionsUrl",
      message:
        f.directionsUrl &&
        !/^https:\/\/\S{3,}$/.test(f.directionsUrl) &&
        "A directions link starts with https://.",
    },
  ];
  const problems = issues
    .filter((i) => i.message)
    .map((i) => i.message as string);
  const text = (
    k: keyof typeof start,
    title: string,
    props: Record<string, unknown> = {},
  ) => (
    <Field title={title} id={`clinic-${k}`}>
      <Input
        id={`clinic-${k}`}
        value={String(f[k])}
        onChange={(e) => {
          set(k)(e.target.value);
          if (k === "code") setCodeEdited(true);
          if (k === "name" && !detail && !codeEdited)
            set("code")(clinicCode(e.target.value));
        }}
        {...props}
      />
    </Field>
  );
  return (
    <form
      className="p-6 space-y-4"
      onBlur={(e) => {
        const id = (e.target as HTMLElement).id;
        if (id) setTouched((old) => new Set([...old, id]));
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (problems.length) {
          setTouched(
            new Set(
              issues.filter((i) => i.message).map((i) => `clinic-${i.field}`),
            ),
          );
          return;
        }
        const ok = detail
          ? await cmd.run(
              `/v1/facilities/${detail.facilityId}`,
              { version: detail.version, ...changes },
              false,
              "PATCH",
            )
          : await cmd.run(
              "/v1/facilities",
              { code, ...changedFields({}, fields) },
              true,
            );
        if (ok) onSaved();
      }}
    >
      <SheetHeader className="p-0">
        <SheetTitle>{detail ? `Edit ${detail.name}` : "Add clinic"}</SheetTitle>
        <SheetDescription>
          {detail
            ? `Code ${detail.code}. Changes are recorded in the activity log.`
            : "The code can't be changed later."}
        </SheetDescription>
      </SheetHeader>
      {!detail && text("code", "Code", { maxLength: 30, placeholder: "IND" })}
      {text("name", "Name", { maxLength: 120 })}
      <Field title="Type" id="clinic-type">
        <Choice
          label="Clinic type"
          value={f.facilityType}
          onChange={set("facilityType")}
          options={FACILITY_TYPES.map((v) => ({ value: v, label: label(v) }))}
        />
      </Field>
      {text("addressLine1", "Address line 1", { maxLength: 200 })}
      {text("addressLine2", "Address line 2", { maxLength: 200 })}
      <div className="grid grid-cols-2 gap-3">
        {text("city", "City", { maxLength: 80 })}
        {text("district", "District", { maxLength: 80 })}
        {text("pincode", "Pincode", { inputMode: "numeric", maxLength: 6 })}
        <Field title="State / territory" id="clinic-stateCode">
          <Choice
            label="State / territory"
            value={customState ? "custom" : f.stateCode}
            onChange={(v) => {
              setCustomState(v === "custom");
              if (v !== "custom") set("stateCode")(v);
            }}
            options={stateChoices(detail?.stateCode ?? "")}
          />
          {customState &&
            text("stateCode", "Other stored state code", {
              inputMode: "numeric",
              maxLength: 2,
            })}
        </Field>
      </div>
      {text("phone", "Phone", { type: "tel", placeholder: "+918012345678" })}
      {text("email", "Email", { type: "email", maxLength: 254 })}
      <Field title="Time zone" id="clinic-timezone">
        <Choice
          label="Time zone"
          value={f.timezone}
          onChange={set("timezone")}
          options={[
            ...new Set([
              "Asia/Kolkata",
              "UTC",
              f.timezone,
              ...Intl.supportedValuesOf("timeZone"),
            ]),
          ].map((value) => ({
            value,
            label:
              value === "Asia/Kolkata"
                ? "India Standard Time · Asia/Kolkata"
                : value,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Appointment dates and schedule times follow this clinic’s time zone.
          Review it before saving.
        </p>
      </Field>
      {text("directionsUrl", "Directions link (https)", {
        type: "url",
        maxLength: 500,
      })}
      <Field title="Arrival instructions" id="clinic-arrival">
        <Textarea
          id="clinic-arrival"
          maxLength={1000}
          value={f.arrivalInstructions}
          onChange={(e) => set("arrivalInstructions")(e.target.value)}
        />
      </Field>
      {detail && (
        <>
          <StatusSwitch
            id="clinic-active"
            active={active}
            onChange={set("active")}
          />
          {!active && detail.status === "active" && (
            <Hint>
              Switching a clinic off needs no booked visits or weekly hours left
              there.
            </Hint>
          )}
        </>
      )}
      {issues
        .filter((i) => i.message && touched.has(`clinic-${i.field}`))
        .map((i) => (
          <p key={i.field} className="text-sm text-destructive">
            {i.message}
          </p>
        ))}
      <Refused cmd={cmd} />
      <Button
        type="submit"
        disabled={
          cmd.busy ||
          problems.length > 0 ||
          (!!detail && !Object.keys(changes!).length)
        }
      >
        {cmd.busy ? "Saving…" : detail ? "Save clinic" : "Add clinic"}
      </Button>
    </form>
  );
}

function DepartmentForm({
  row,
  onSaved,
}: {
  row: Department | null;
  onSaved: () => void;
}) {
  const { facility } = useWorkspace(),
    cmd = useCommand();
  const specialties = useQuery<{ items: Specialty[] }>("/v1/specialties");
  const [code, setCode] = useState(row?.code ?? ""),
    [name, setName] = useState(row?.name ?? ""),
    [kind, setKind] = useState(row?.kind ?? "clinical"),
    [specialty, setSpecialty] = useState(row?.specialty ?? "none"),
    [active, setActive] = useState((row?.status ?? "active") === "active");
  const body = {
    name: name.trim(),
    kind,
    specialty: specialty === "none" ? null : specialty,
  };
  const changes = row
    ? {
        ...changedFields(
          { name: row.name, kind: row.kind, specialty: row.specialty },
          body,
        ),
        ...(active !== (row.status === "active")
          ? { status: active ? "active" : "inactive" }
          : {}),
      }
    : null;
  useUnsaved(row ? Object.keys(changes!).length > 0 : !!(code || name), {
    pending: cmd.busy || cmd.unknown,
  });
  const valid = name.trim().length >= 2 && (!!row || CODE.test(code));
  return (
    <form
      className="p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = row
          ? await cmd.run(
              `/v1/departments/${row.departmentId}`,
              { version: row.version, ...changes },
              false,
              "PATCH",
            )
          : await cmd.run(
              `/v1/facilities/${facility.facilityId}/departments`,
              { code: code.trim(), ...body },
              true,
            );
        if (ok) onSaved();
      }}
    >
      <SheetHeader className="p-0">
        <SheetTitle>{row ? `Edit ${row.name}` : "Add department"}</SheetTitle>
        <SheetDescription>{facility.name}</SheetDescription>
      </SheetHeader>
      {!row && (
        <Field title="Code" id="dept-code">
          <Input
            id="dept-code"
            value={code}
            maxLength={30}
            placeholder="ENT"
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
      )}
      <Field title="Name" id="dept-name">
        <Input
          id="dept-name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field title="Kind" id="dept-kind">
        <Choice
          label="Department kind"
          value={kind}
          onChange={setKind}
          options={["clinical", "diagnostic", "support", "administrative"].map(
            (v) => ({ value: v, label: label(v) }),
          )}
        />
      </Field>
      <Field title="Specialty" id="dept-specialty">
        <Choice
          label="Specialty"
          value={specialty}
          onChange={setSpecialty}
          options={[
            { value: "none", label: "None" },
            ...(specialties.data?.items ?? []).map((s) => ({
              value: s.code,
              label: s.name,
            })),
          ]}
        />
      </Field>
      {row && (
        <StatusSwitch id="dept-active" active={active} onChange={setActive} />
      )}
      <Refused cmd={cmd} />
      <Button
        type="submit"
        disabled={
          cmd.busy || !valid || (!!row && !Object.keys(changes!).length)
        }
      >
        {cmd.busy ? "Saving…" : row ? "Save department" : "Add department"}
      </Button>
    </form>
  );
}

function ServiceForm({
  row,
  departments,
  fee,
  onSaved,
}: {
  row: HealthcareService | null;
  departments: Department[];
  fee: PriceBookItem | undefined;
  onSaved: () => void;
}) {
  const { facility, can } = useWorkspace(),
    cmd = useCommand(),
    feeCmd = useCommand();
  const [detailsSaved, setDetailsSaved] = useState(false),
    [rechecking, setRechecking] = useState(false),
    [recoveryNote, setRecoveryNote] = useState("");
  const manage = can("catalog.manage"),
    pricing = can("pricing.manage");
  const [departmentId, setDepartmentId] = useState(
      row?.departmentId ?? departments[0]?.departmentId ?? "",
    ),
    [code, setCode] = useState(row?.code ?? ""),
    [name, setName] = useState(row?.name ?? ""),
    [mode, setMode] = useState<HealthcareService["serviceMode"]>(
      row?.serviceMode ?? "in_person",
    ),
    [duration, setDuration] = useState(String(row?.defaultDurationMin ?? 15)),
    [isPublic, setIsPublic] = useState(row?.isPublic ?? true),
    [active, setActive] = useState((row?.status ?? "active") === "active"),
    [feeText, setFeeText] = useState(minorToRupees(fee?.feeMinor)),
    [feeFrom, setFeeFrom] = useState(today(facility.timezone));
  const minutes = Number(duration);
  const feeMinor = rupeesToMinor(feeText);
  const feeChanged =
    feeMinor !== undefined && feeMinor !== (fee?.feeMinor ?? null);
  const fields = {
    name: name.trim(),
    serviceMode: mode,
    defaultDurationMin: minutes,
    isPublic,
  };
  const changes = row
    ? {
        ...changedFields(
          {
            name: row.name,
            serviceMode: row.serviceMode,
            defaultDurationMin: row.defaultDurationMin,
            isPublic: row.isPublic,
          },
          fields,
        ),
        ...(active !== (row.status === "active")
          ? { status: active ? "active" : "inactive" }
          : {}),
      }
    : null;
  const dirty = row
    ? (!detailsSaved && Object.keys(changes!).length > 0) || feeChanged
    : !!(code || name);
  useUnsaved(dirty, {
    pending: cmd.busy || cmd.unknown || feeCmd.busy || feeCmd.unknown,
  });
  const valid =
    name.trim().length >= 2 &&
    Number.isInteger(minutes) &&
    minutes >= 5 &&
    minutes <= 480 &&
    feeMinor !== undefined &&
    (!!row || (CODE.test(code) && !!departmentId));
  return (
    <form
      className="p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!row) {
          const made = await cmd.run(
            `/v1/departments/${departmentId}/services`,
            {
              code: code.trim(),
              ...fields,
              ...(pricing && feeMinor !== null ? { feeMinor } : {}),
            },
            true,
          );
          if (made) onSaved();
          return;
        }
        if (!valid || cmd.unknown || feeCmd.unknown) return;
        if (!detailsSaved && Object.keys(changes!).length) {
          if (
            !(await cmd.run(
              `/v1/healthcare-services/${row.healthcareServiceId}`,
              { version: row.version, ...changes },
              false,
              "PATCH",
            ))
          )
            return;
          setDetailsSaved(true);
        }
        if (
          feeChanged &&
          !(await feeCmd.run(
            `/v1/healthcare-services/${row.healthcareServiceId}/fee`,
            { mode: "any", feeMinor, effectiveFrom: feeFrom },
            false,
            "PUT",
          ))
        )
          return;
        onSaved();
      }}
    >
      <SheetHeader className="p-0">
        <SheetTitle>
          {row ? `Edit ${row.name}` : "Add bookable service"}
        </SheetTitle>
        <SheetDescription>{facility.name}</SheetDescription>
      </SheetHeader>
      {!row && (
        <>
          <Field title="Department" id="svc-dept">
            <Choice
              label="Department"
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((d) => ({
                value: d.departmentId,
                label: d.name,
              }))}
            />
          </Field>
          <Field title="Code" id="svc-code">
            <Input
              id="svc-code"
              value={code}
              maxLength={30}
              placeholder="ENT-OPD"
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        </>
      )}
      <fieldset
        disabled={
          !manage ||
          detailsSaved ||
          cmd.busy ||
          cmd.unknown ||
          feeCmd.busy ||
          feeCmd.unknown
        }
        className="space-y-4"
      >
        <Field title="Name" id="svc-name">
          <Input
            id="svc-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field title="Visit type" id="svc-mode">
          <Choice
            label="Visit type"
            value={mode}
            disabled={!manage || detailsSaved || cmd.unknown || feeCmd.unknown}
            onChange={(v) => setMode(v as HealthcareService["serviceMode"])}
            options={[
              { value: "in_person", label: "In person" },
              { value: "virtual", label: "Video" },
              { value: "both", label: "In person and video" },
            ]}
          />
        </Field>
        <Field title="Usual length (minutes)" id="svc-duration">
          <Input
            id="svc-duration"
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="svc-public">
            Bookable by patients (website, WhatsApp, voice)
          </Label>
          <Switch
            id="svc-public"
            checked={isPublic}
            disabled={!manage || detailsSaved || cmd.unknown || feeCmd.unknown}
            onCheckedChange={setIsPublic}
          />
        </div>
        {row && (
          <StatusSwitch
            id="svc-active"
            active={active}
            onChange={setActive}
            disabled={!manage || detailsSaved || cmd.unknown || feeCmd.unknown}
          />
        )}
      </fieldset>
      <fieldset
        disabled={
          !pricing || cmd.busy || cmd.unknown || feeCmd.busy || feeCmd.unknown
        }
        className="space-y-4 border-t pt-4"
      >
        <Field title="Default consultation fee (₹)" id="svc-fee">
          <Input
            id="svc-fee"
            inputMode="decimal"
            value={feeText}
            placeholder="Not priced"
            onChange={(e) => setFeeText(e.target.value)}
          />
        </Field>
        {feeMinor === undefined && (
          <p className="text-sm text-destructive">
            Enter the fee in rupees, e.g. 500 or 450.50.
          </p>
        )}
        {row && feeChanged && (
          <Field title="New fee applies from" id="svc-fee-from">
            <Input
              id="svc-fee-from"
              type="date"
              min={today(facility.timezone)}
              value={feeFrom}
              onChange={(e) => setFeeFrom(e.target.value)}
            />
          </Field>
        )}
        <p className="text-xs text-muted-foreground">
          {pricing
            ? "Bookings already made keep the fee they were booked at. Clearing the fee leaves the service unpriced from that date."
            : "Only someone who manages prices can change fees."}
        </p>
      </fieldset>
      {detailsSaved && (
        <Hint>
          Service details were saved. Only the consultation fee remains;
          resuming will not save the details again.
        </Hint>
      )}
      <Refused cmd={cmd} />
      <Refused cmd={feeCmd} />
      {(cmd.unknown || feeCmd.unknown) && row && (
        <div className="space-y-3">
          <Hint>
            The save outcome is uncertain. Check the current record before
            attempting another change.
          </Hint>
          <Button
            type="button"
            variant="outline"
            disabled={rechecking}
            onClick={async () => {
              setRechecking(true);
              setRecoveryNote("");
              try {
                if (cmd.unknown) {
                  const d = await request<ClinicDirectory>(
                    `/v1/facilities/${facility.facilityId}/directory?includeInactive=true`,
                  );
                  const current = d.services.find(
                    (s) => s.healthcareServiceId === row.healthcareServiceId,
                  );
                  if (
                    current &&
                    Object.entries(changes!).every(
                      ([k, v]) =>
                        (current as unknown as Record<string, unknown>)[k] ===
                        v,
                    )
                  ) {
                    cmd.reconciled();
                    setDetailsSaved(true);
                    setRecoveryNote(
                      "Current service details match your requested change. Continue with the remaining fee, if needed.",
                    );
                  } else
                    setRecoveryNote(
                      "The current service details do not confirm your original change. Keep this form open and ask the administrator to review the request before retrying.",
                    );
                } else {
                  const d = await request<{ items: PriceBookItem[] }>(
                    `/v1/facilities/${facility.facilityId}/price-book?on=${feeFrom}`,
                  );
                  const effective = d.items
                    .filter(
                      (p) =>
                        p.healthcareServiceId === row.healthcareServiceId &&
                        p.staffId === null &&
                        p.mode === "any" &&
                        p.validFrom <= feeFrom &&
                        (!p.validTo || p.validTo > feeFrom),
                    )
                    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
                  if ((effective?.feeMinor ?? null) === feeMinor) {
                    feeCmd.reconciled();
                    onSaved();
                  } else
                    setRecoveryNote(
                      "The current fee does not confirm your original request. Ask the administrator to review that request before another fee change.",
                    );
                }
              } catch (e) {
                setRecoveryNote(
                  e instanceof Error
                    ? e.message
                    : "Could not reload the current record.",
                );
              } finally {
                setRechecking(false);
              }
            }}
          >
            {rechecking ? "Checking…" : "Check current saved record"}
          </Button>
        </div>
      )}
      {recoveryNote && <Hint>{recoveryNote}</Hint>}
      <Button
        type="submit"
        disabled={
          cmd.busy ||
          (cmd.unknown && !!row) ||
          feeCmd.busy ||
          feeCmd.unknown ||
          !valid ||
          !dirty
        }
      >
        {cmd.busy || feeCmd.busy
          ? "Saving…"
          : cmd.unknown && !row
            ? "Check original service request"
            : detailsSaved
              ? "Resume fee save"
              : row
                ? "Save service"
                : "Add service"}
      </Button>
    </form>
  );
}

function RoomForm({
  row,
  departments,
  onSaved,
}: {
  row: ConsultRoom | null;
  departments: Department[];
  onSaved: () => void;
}) {
  const { facility } = useWorkspace(),
    cmd = useCommand();
  const [code, setCode] = useState(row?.code ?? ""),
    [name, setName] = useState(row?.name ?? ""),
    [departmentId, setDepartmentId] = useState(row?.departmentId ?? "none"),
    [active, setActive] = useState((row?.status ?? "active") === "active");
  const fields = {
    name: name.trim(),
    departmentId: departmentId === "none" ? null : departmentId,
  };
  const changes = row
    ? {
        ...changedFields(
          { name: row.name, departmentId: row.departmentId },
          fields,
        ),
        ...(active !== (row.status === "active")
          ? { status: active ? "active" : "inactive" }
          : {}),
      }
    : null;
  useUnsaved(row ? Object.keys(changes!).length > 0 : !!(code || name), {
    pending: cmd.busy || cmd.unknown,
  });
  const valid = name.trim().length >= 2 && (!!row || CODE.test(code));
  return (
    <form
      className="p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = row
          ? await cmd.run(
              `/v1/consult-rooms/${row.locationId}`,
              { version: row.version, ...changes },
              false,
              "PATCH",
            )
          : await cmd.run(
              `/v1/facilities/${facility.facilityId}/consult-rooms`,
              { code: code.trim(), ...fields },
              true,
            );
        if (ok) onSaved();
      }}
    >
      <SheetHeader className="p-0">
        <SheetTitle>{row ? `Edit ${row.name}` : "Add consult room"}</SheetTitle>
        <SheetDescription>{facility.name}</SheetDescription>
      </SheetHeader>
      {!row && (
        <Field title="Code" id="room-code">
          <Input
            id="room-code"
            value={code}
            maxLength={30}
            placeholder="C-1"
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
      )}
      <Field title="Name" id="room-name">
        <Input
          id="room-name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field title="Department" id="room-dept">
        <Choice
          label="Room department"
          value={departmentId}
          onChange={setDepartmentId}
          options={[
            { value: "none", label: "Shared" },
            ...departments.map((d) => ({
              value: d.departmentId,
              label: d.name,
            })),
          ]}
        />
      </Field>
      {row && (
        <StatusSwitch id="room-active" active={active} onChange={setActive} />
      )}
      <Refused cmd={cmd} />
      <Button
        type="submit"
        disabled={
          cmd.busy || !valid || (!!row && !Object.keys(changes!).length)
        }
      >
        {cmd.busy ? "Saving…" : row ? "Save room" : "Add room"}
      </Button>
    </form>
  );
}
