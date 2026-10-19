import { BirthDateField } from "./BirthDateField";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { PhoneField } from "@/components/WorkspaceFields";
import { Combobox } from "@/components/arc/combobox/combobox";
import { toast } from "@/components/toast-events";
import { Input as ArcInput } from "@/components/arc/input/input";
import { PatientVisitActions } from "./PatientVisits";
import { appointmentModeLabel, type AppointmentMode } from "./booking-workflow";
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { query } from "./client";
import { FullPage } from "./FullPage";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestLeave, useUnsaved } from "./leave";
import { label, needsCareAccess } from "./model";
import { E164, PINCODE, blankToNull, changedFields, isStale } from "./forms";
import {
  Choice,
  Empty,
  ErrorMessage,
  Field,
  Hint,
  LoadingState,
  Status,
} from "./ui";
import { AllergiesProblems, BreakGlass } from "./ClinicalRecords";
import { DuplicateQueue, PatientRegistry } from "./PatientRegistry";
import type { Chart, Patient, PatientDetail } from "./types";

import { patientDisplayName, isTestPatient } from "./patient-presentation";

export function TestPatientBadge({ patientId }: { patientId: string }) {
  return isTestPatient(patientId) ? (
    <span className="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">
      Test patient
    </span>
  ) : null;
}

export function PatientLookup({
  onSelect,
  onRegister,
}: {
  onSelect: (patient: Patient) => void;
  onRegister?: () => void;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    // Results follow the text as it is typed; the last keystroke wins.
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const digits = search.replace(/[\s()-]/g, "");
  const params = search.startsWith("+")
    ? { phone: digits, limit: 20 }
    : /^\d{10}$/.test(digits)
      ? { phone: `+91${digits}`, limit: 20 }
      : { q: search, limit: 20 };
  const result = useQuery<{ items: Patient[] }>(
    search.length >= 2 ? `/v1/patients?${query(params)}` : null,
  );
  const pending = text.trim() !== search || result.loading;
  const patients =
    search.length >= 2 && !pending && !result.error
      ? (result.data?.items ?? [])
      : [];
  return (
    <div className="space-y-3">
      <div className="arc-demo-scope">
        <Combobox
          label="Patient search"
          ref={searchInput}
          placeholder="Type a name, MRN or phone"
          autoComplete="off"
          value=""
          onQueryChange={setText}
          filterOptions={false}
          aria-busy={text.trim().length >= 2 && pending}
          options={patients.map((patient) => ({
            value: patient.patientId,
            label: `${patientDisplayName(patient.patientId, patient.name)} · MRN ${patient.mrn} · ${patient.phone ?? "No phone recorded"}${isTestPatient(patient.patientId) ? " · Test patient" : ""}${patient.status !== "active" ? " · Inactive" : ""}`,
            disabled: patient.status !== "active",
          }))}
          emptyMessage={
            text.trim().length < 2
              ? "Type at least 2 characters"
              : pending
                ? "Searching…"
                : result.error
                  ? "Search could not load. Try again."
                  : "No patient found"
          }
          onValueChange={(id) => {
            const patient = patients.find((p) => p.patientId === id);
            if (patient?.status === "active") onSelect(patient);
          }}
        />
      </div>
      <ErrorMessage text={result.error} />
      {search.length >= 2 &&
        !pending &&
        !result.loading &&
        !result.error &&
        result.data?.items.length === 0 && (
          <WorkspaceEmpty
            title="No patient found"
            action={
              onRegister
                ? { label: "Register patient", onClick: onRegister }
                : {
                    label: "Edit search",
                    onClick: () => searchInput.current?.focus(),
                  }
            }
          />
        )}
    </div>
  );
}
export function RegisterPatient({
  onCreated,
  submitLabel,
}: {
  onCreated: (patient: Patient) => void;
  submitLabel?: string;
}) {
  const { facility } = useWorkspace(),
    cmd = useCommand();
  const [givenName, setGivenName] = useState(""),
    [familyName, setFamilyName] = useState(""),
    [phone, setPhone] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [sex, setSex] = useState("unknown");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) =>
    setTouched((current) => ({ ...current, [key]: true }));
  useUnsaved(
    !!(givenName || familyName || phone || birthDate) || sex !== "unknown",
    { pending: cmd.busy || cmd.unknown },
  );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (phone && !E164.test(phone)) {
          touch("phone");
          return;
        }
        const result = await cmd.run<{ patientId: string; mrn: string }>(
          "/v1/patients",
          {
            givenName: givenName.trim(),
            ...(familyName.trim() ? { familyName: familyName.trim() } : {}),
            sex,
            ...(phone ? { phone } : {}),
            ...(birthDate ? { birthDate } : {}),
            registeredFacilityId: facility.facilityId,
            source: "front_desk",
          },
          true,
        );
        if (result) {
          toast.success("Patient registered");
          onCreated({
            patientId: result.patientId,
            mrn: result.mrn,
            name: `${givenName} ${familyName}`.trim(),
            phone: phone || null,
            birthDate: birthDate || null,
            sex,
            status: "active",
          });
        }
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="arc-demo-scope">
          <ArcInput
            label="Given name (required)"
            error={
              touched.given && !givenName.trim()
                ? "Enter the patient’s given name."
                : undefined
            }
            onBlur={() => touch("given")}
            id="given-name"
            autoFocus
            required
            maxLength={100}
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
          />
        </div>
        <div className="arc-demo-scope">
          <ArcInput
            label="Family name"
            id="family-name"
            maxLength={100}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>
      </div>
      <Field title="Sex" id="patient-sex">
        <Choice
          label="Sex"
          value={sex}
          onChange={setSex}
          options={["unknown", "female", "male", "other"].map((v) => ({
            value: v,
            label: label(v),
          }))}
        />
      </Field>
      <BirthDateField
        id="birth-date"
        label="Date of birth (optional)"
        value={birthDate}
        onValueChange={setBirthDate}
      />
      <PhoneField
        label="Phone (optional, with country code)"
        id="patient-phone"
        value={phone}
        onValueChange={setPhone}
        error={
          touched.phone && phone && !E164.test(phone)
            ? "Enter a phone number with its country code."
            : undefined
        }
        onBlur={() => touch("phone")}
      />
      <ErrorMessage text={cmd.error} />
      <Button type="submit" disabled={cmd.busy || !givenName.trim()}>
        {cmd.busy ? "Registering…" : (submitLabel ?? "Register patient")}
      </Button>
    </form>
  );
}
export function Patients() {
  const { can, facility, go } = useWorkspace();
  const [registrationMode, setRegistrationMode] = useState<
    AppointmentMode | "none"
  >("none");
  const [openedId, setOpenedId] = useState<string | null>(() =>
      new URLSearchParams(location.search).get("patient"),
    ),
    [register, setRegister] = useState(false),
    [registered, setRegistered] = useState(0);
  const select = (p: Patient) => {
    setOpenedId(p.patientId);
  };
  if (register)
    return (
      <FullPage
        title="Register patient"
        back="Back to patients"
        onBack={() => setRegister(false)}
      >
        <div className="max-w-3xl space-y-5">
          {can("appointments.book") && (
            <section className="space-y-3">
              <h2 className="font-semibold">After registration</h2>
              <div className="grid grid-cols-3 gap-3">
                {(["none", "in_person", "virtual"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={registrationMode === mode ? "default" : "outline"}
                    aria-pressed={registrationMode === mode}
                    onClick={() => setRegistrationMode(mode)}
                  >
                    {mode === "none"
                      ? "Register only"
                      : appointmentModeLabel(mode)}
                  </Button>
                ))}
              </div>
            </section>
          )}
          <RegisterPatient
            submitLabel={
              registrationMode === "none"
                ? "Register patient"
                : `Register & book ${appointmentModeLabel(registrationMode).toLowerCase()}`
            }
            onCreated={(p) => {
              setRegister(false);
              setRegistered((n) => n + 1);
              if (registrationMode !== "none" && can("appointments.book"))
                go(
                  `appointments?book=1&patient=${p.patientId}&mode=${registrationMode}`,
                );
              else select(p);
            }}
          />
        </div>
      </FullPage>
    );
  if (openedId)
    return (
      <PatientRecord
        key={openedId}
        patientId={openedId}
        onBack={() => {
          setOpenedId(null);
          history.replaceState(history.state, "", location.pathname);
        }}
      />
    );
  return (
    <>
      <PageTitle
        title="Patients"
        action={
          can("patients.register") ? (
            <Button onClick={() => setRegister(true)}>
              <UserPlus />
              Register patient
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="pt-6">
          <PatientLookup
            onSelect={select}
            onRegister={
              can("patients.register") ? () => setRegister(true) : undefined
            }
          />
        </CardContent>
      </Card>
      {/* Remounting starts the list again at page 1 for a new clinic or a new registration. */}
      <ClinicPatients
        key={`${facility.facilityId}:${registered}`}
        onSelect={select}
      />
      {can("patients.merge") && <DuplicateQueue />}
    </>
  );
}
function ClinicPatients({
  onSelect,
}: {
  onSelect: (patient: Patient) => void;
}) {
  const { facility } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const page = useQuery<{ items: Patient[]; more: boolean }>(
    `/v1/patients?${query({ facilityId: facility.facilityId, limit: 20, offset })}`,
  );
  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-3">
        <h2 className="font-semibold">Registered at {facility.name}</h2>
        <LoadingState {...page}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MRN</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Sex · date of birth</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.data?.items.map((p) => (
                <TableRow key={p.patientId}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="px-0 font-medium"
                      aria-label={`Open ${patientDisplayName(p.patientId, p.name)} record`}
                      onClick={() => onSelect(p)}
                    >
                      {patientDisplayName(p.patientId, p.name)}
                    </Button>
                    <TestPatientBadge patientId={p.patientId} />
                  </TableCell>
                  <TableCell>
                    <span className="arc-demo-scope inline-flex items-center gap-2">
                      {p.mrn}
                      <CopyButton
                        value={p.mrn}
                        label="Copy MRN"
                        iconOnly
                        variant="plain"
                      />
                    </span>
                  </TableCell>
                  <TableCell>{p.phone ?? "—"}</TableCell>
                  <TableCell>
                    {label(p.sex)} · {p.birthDate ?? "not recorded"}
                  </TableCell>
                  <TableCell>
                    <Status value={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {page.data?.items.length === 0 && (
            <Empty>No patients registered at this clinic yet.</Empty>
          )}
          {(offset > 0 || page.data?.more) && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!page.data?.more}
                onClick={() => setOffset(offset + 20)}
              >
                Next
              </Button>
            </div>
          )}
        </LoadingState>
      </CardContent>
    </Card>
  );
}
function PatientRecord({
  patientId,
  onBack,
}: {
  patientId: string;
  onBack: () => void;
}) {
  const { can, go } = useWorkspace();
  const detail = useQuery<PatientDetail>(`/v1/patients/${patientId}`);
  const [tab, setTab] = useState("overview"),
    [editing, setEditing] = useState(false);
  const d = detail.data;
  const address = d?.address
    ? [
        d.address.line1,
        d.address.line2,
        d.address.city,
        d.address.district,
        d.address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  return (
    <FullPage
      title="Patient record"
      back="Back to patients"
      onBack={onBack}
      summary={
        d && (
          <div className="flex shrink-0 items-start gap-5 text-right">
            <div>
              <h2 className="text-lg font-semibold">
                {patientDisplayName(
                  patientId,
                  `${d.givenName} ${d.familyName ?? ""}`.trim(),
                )}
                <span className="ml-3">
                  <TestPatientBadge patientId={patientId} />
                </span>
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                MRN {d.mrn} · {label(d.sex)} ·{" "}
                {d.birthDate ?? "Birth date not recorded"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {d.status === "active" && can("appointments.book") && (
                <Button
                  variant="outline"
                  onClick={() => go(`appointments?book=1&patient=${patientId}`)}
                >
                  Book appointment
                </Button>
              )}
            </div>
          </div>
        )
      }
    >
      <LoadingState {...detail}>
        {d?.status === "active" && (
          <PatientVisitActions patientId={patientId} />
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            requestLeave(() => {
              setTab(v);
              setEditing(false);
            });
          }}
        >
          <TabsList
            className="w-full gap-3 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
            aria-label="Patient record sections"
          >
            <TabsTrigger
              value="overview"
              className="h-auto min-h-16 flex-col items-start justify-center rounded-lg border border-border px-5 py-3 text-left text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background"
            >
              <span className="font-semibold">Overview</span>
              <span className="text-sm font-normal opacity-80">
                Patient details & contacts
              </span>
            </TabsTrigger>
            {can("clinical.read") && (
              <TabsTrigger
                value="history"
                className="h-auto min-h-16 flex-col items-start justify-center rounded-lg border border-border px-5 py-3 text-left text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background"
              >
                <span className="font-semibold">Medical history</span>
                <span className="text-sm font-normal opacity-80">
                  Previous visits, allergies & records
                </span>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        {tab === "overview" && (
          <section className="space-y-5">
            {d && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Patient details</CardTitle>
                  {!editing &&
                    d.status !== "merged" &&
                    can("patients.update") && (
                      <Button
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        Edit details
                      </Button>
                    )}
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <EditPatient
                      key={d.version}
                      d={d}
                      onDone={(saved) => {
                        setEditing(false);
                        if (saved) void detail.refresh();
                      }}
                    />
                  ) : (
                    <>
                      <dl className="grid grid-cols-3 gap-x-8 gap-y-5 text-base">
                        {[
                          [
                            "Name",
                            patientDisplayName(
                              patientId,
                              `${d.givenName} ${d.familyName ?? ""}`.trim(),
                            ),
                          ],
                          ["MRN", d.mrn],
                          ["Sex", label(d.sex)],
                          [
                            "Date of birth",
                            `${d.birthDate ?? "Not recorded"}${d.birthDateEstimated ? " (estimated)" : ""}`,
                          ],
                          [
                            "Preferred language",
                            d.preferredLanguage ?? "Not recorded",
                          ],
                          ["Blood group", d.bloodGroup ?? "Not recorded"],
                          [
                            "Marital status",
                            d.maritalStatus
                              ? label(d.maritalStatus)
                              : "Not recorded",
                          ],
                          ["Occupation", d.occupation ?? "Not recorded"],
                          ...d.contacts.map((contact) => [
                            label(contact.kind),
                            contact.value,
                          ]),
                        ].map(([title, value], index) => (
                          <div key={`${title}:${index}`}>
                            <dt className="text-muted-foreground">{title}</dt>
                            <dd className="mt-1 font-medium">{value}</dd>
                          </div>
                        ))}
                        <div className="col-span-3">
                          <dt className="text-muted-foreground">Address</dt>
                          <dd className="mt-1 font-medium">
                            {address || "Not recorded"}
                          </dd>
                        </div>
                      </dl>
                      {d.status === "merged" && (
                        <Hint>
                          This record was merged into another one; edit the
                          surviving record.
                        </Hint>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            {d && !editing && (
              <PatientRegistry
                section="overview"
                patientId={patientId}
                onMerged={() => void detail.refresh()}
              />
            )}
          </section>
        )}
        {tab === "history" && can("clinical.read") && (
          <section className="space-y-6 text-base">
            <h2 className="text-xl font-semibold">Medical history</h2>
            <PatientChart patientId={patientId} includeRegistry />
          </section>
        )}
      </LoadingState>
    </FullPage>
  );
}
export function PatientChart({
  patientId,
  editable = true,
  includeRegistry = false,
}: {
  patientId: string;
  editable?: boolean;
  includeRegistry?: boolean;
}) {
  const { go, can } = useWorkspace();
  const result = useQuery<Chart>(
    can("clinical.read") ? `/v1/patients/${patientId}/chart` : null,
  );
  if (result.failure?.status === 403 || !can("clinical.read"))
    return (
      <div className="space-y-4">
        <Hint>
          Your account cannot open this patient's medical history. Ask the
          clinic administrator to arrange access.
        </Hint>
        {needsCareAccess(result.failure) && can("break_glass.use") && (
          <BreakGlass patientId={patientId} onGranted={result.refresh} />
        )}
      </div>
    );
  const fresh = !result.error && !result.loading && !result.failure;
  return (
    <LoadingState {...result}>
      {result.data && (
        <div className="space-y-6">
          <AllergiesProblems
            patientId={patientId}
            allergies={result.data.allergies}
            problems={result.data.problems}
            editable={editable && can("clinical.write") && fresh}
            onChanged={result.refresh}
          />
          <section className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">Latest vitals</h3>
            {result.data.latestVitals.length ? (
              result.data.latestVitals.map((v) => (
                <div
                  key={v.code}
                  className="flex justify-between border-b py-2 text-sm"
                >
                  <span>{v.display}</span>
                  <span>
                    {v.valueNum ?? v.valueText} {v.unit}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No vitals recorded.
              </p>
            )}
          </section>
          <section className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">Previous visits</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visit</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.encounters.map((e) => (
                  <TableRow key={e.encounterId}>
                    <TableCell>
                      <Button
                        variant="link"
                        onClick={() =>
                          go(`consultations?encounter=${e.encounterId}`)
                        }
                      >
                        {e.encounterNo}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.arrivedAt).toLocaleDateString("en-IN")}
                      </p>
                    </TableCell>
                    <TableCell>{e.attendingName}</TableCell>
                    <TableCell>
                      <Status value={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!result.data.encounters.length && (
              <p className="text-sm text-muted-foreground">
                No visits recorded.
              </p>
            )}
          </section>
          {includeRegistry && fresh && (
            <PatientRegistry
              section="history"
              patientId={patientId}
              allowNka={editable && result.data.allergies.length === 0}
            />
          )}
        </div>
      )}
    </LoadingState>
  );
}

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MARITAL = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
  "unknown",
];

/** Demographics, primary phone and email, and home address; the API refuses a stale form (409). */
function EditPatient({
  d,
  onDone,
}: {
  d: PatientDetail;
  onDone: (saved: boolean) => void;
}) {
  const cmd = useCommand();
  const contact = (kind: string) =>
    d.contacts.find((c) => c.kind === kind && c.is_primary)?.value ??
    d.contacts.find((c) => c.kind === kind)?.value ??
    "";
  const start = {
    givenName: d.givenName,
    familyName: d.familyName ?? "",
    sex: d.sex,
    birthDate: d.birthDate ?? "",
    birthDateEstimated: !!d.birthDateEstimated,
    phone: contact("phone"),
    email: contact("email"),
    preferredLanguage: d.preferredLanguage ?? "",
    bloodGroup: d.bloodGroup ?? "none",
    maritalStatus: d.maritalStatus ?? "none",
    occupation: d.occupation ?? "",
    line1: d.address?.line1 ?? "",
    line2: d.address?.line2 ?? "",
    city: d.address?.city ?? "",
    district: d.address?.district ?? "",
    stateCode: d.address?.stateCode ?? "",
    pincode: d.address?.pincode ?? "",
  };
  const [f, setF] = useState(start);
  const set = (k: keyof typeof start) => (v: string | boolean) =>
    setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  useUnsaved(dirty, { pending: cmd.busy || cmd.unknown });
  const problems = [
    !f.givenName.trim() && "Enter the given name.",
    f.phone &&
      !E164.test(f.phone) &&
      "Use the international phone format, e.g. +919876543210.",
    f.email &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) &&
      "Check the email address.",
    f.pincode && !PINCODE.test(f.pincode) && "A pincode is 6 digits.",
    f.stateCode &&
      !/^[0-9]{2}$/.test(f.stateCode) &&
      "The state code is 2 digits (Karnataka is 29).",
  ].filter(Boolean) as string[];
  const addressKeys = [
    "line1",
    "line2",
    "city",
    "district",
    "stateCode",
    "pincode",
  ] as const;
  const addressChanged = addressKeys.some((k) => f[k] !== start[k]);
  const text = (
    k: keyof typeof start,
    title: string,
    props: Record<string, unknown> = {},
  ) => (
    <Field title={title} id={`pt-${k}`}>
      <Input
        id={`pt-${k}`}
        value={String(f[k])}
        onChange={(e) => set(k)(e.target.value)}
        {...props}
      />
    </Field>
  );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fields = {
          givenName: f.givenName,
          familyName: f.familyName,
          sex: f.sex,
          birthDate: f.birthDate,
          birthDateEstimated: f.birthDateEstimated,
          phone: f.phone,
          email: f.email,
          preferredLanguage: f.preferredLanguage,
          bloodGroup: f.bloodGroup === "none" ? null : f.bloodGroup,
          maritalStatus: f.maritalStatus === "none" ? null : f.maritalStatus,
          occupation: f.occupation,
        };
        const before = {
          ...start,
          bloodGroup: start.bloodGroup === "none" ? null : start.bloodGroup,
          maritalStatus:
            start.maritalStatus === "none" ? null : start.maritalStatus,
        };
        const body = {
          version: d.version,
          ...changedFields(before, fields),
          ...(addressChanged
            ? {
                address: Object.fromEntries(
                  addressKeys.map((k) => [k, blankToNull(f[k])]),
                ),
              }
            : {}),
        };
        if (
          await cmd.run(`/v1/patients/${d.patientId}`, body, false, "PATCH")
        ) {
          toast.success("Patient details saved");
          onDone(true);
        }
      }}
    >
      <h3 className="font-semibold">Edit details</h3>
      <div className="grid grid-cols-2 gap-3">
        {text("givenName", "Given name", { maxLength: 100, required: true })}
        {text("familyName", "Family name", { maxLength: 100 })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field title="Sex" id="pt-sex">
          <Choice
            label="Sex"
            value={f.sex}
            onChange={set("sex")}
            options={["unknown", "female", "male", "other"].map((v) => ({
              value: v,
              label: label(v),
            }))}
          />
        </Field>
        <BirthDateField
          id="pt-birthDate"
          label="Date of birth"
          value={f.birthDate}
          onValueChange={set("birthDate")}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.birthDateEstimated}
          onChange={(e) => set("birthDateEstimated")(e.target.checked)}
        />
        Date of birth is estimated
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field title="Phone (with country code)" id="pt-phone">
          <PhoneField
            id="pt-phone"
            label="Phone (with country code)"
            value={f.phone}
            onValueChange={set("phone")}
          />
        </Field>
        {text("email", "Email", { type: "email", maxLength: 254 })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text("preferredLanguage", "Preferred language", { maxLength: 40 })}
        {text("occupation", "Occupation", { maxLength: 80 })}
        <Field title="Blood group" id="pt-blood">
          <Choice
            label="Blood group"
            value={f.bloodGroup}
            onChange={set("bloodGroup")}
            options={[
              { value: "none", label: "Not recorded" },
              ...BLOOD.map((v) => ({ value: v, label: v })),
            ]}
          />
        </Field>
        <Field title="Marital status" id="pt-marital">
          <Choice
            label="Marital status"
            value={f.maritalStatus}
            onChange={set("maritalStatus")}
            options={[
              { value: "none", label: "Not recorded" },
              ...MARITAL.map((v) => ({ value: v, label: label(v) })),
            ]}
          />
        </Field>
      </div>
      <h4 className="text-sm font-medium">Home address</h4>
      {text("line1", "Address line 1", { maxLength: 200 })}
      {text("line2", "Address line 2", { maxLength: 200 })}
      <div className="grid grid-cols-2 gap-3">
        {text("city", "City", { maxLength: 80 })}
        {text("district", "District", { maxLength: 80 })}
        {text("stateCode", "State code", {
          inputMode: "numeric",
          maxLength: 2,
        })}
        {text("pincode", "Pincode", { inputMode: "numeric", maxLength: 6 })}
      </div>
      {problems.map((x) => (
        <p key={x} className="text-sm text-destructive">
          {x}
        </p>
      ))}
      <ErrorMessage
        text={
          isStale(cmd.failure)
            ? "Someone else changed this patient first. Close and reopen to see their change."
            : cmd.error
        }
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={cmd.busy || !dirty || problems.length > 0}
        >
          {cmd.busy ? "Saving…" : "Save details"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={cmd.busy}
          onClick={() => onDone(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
