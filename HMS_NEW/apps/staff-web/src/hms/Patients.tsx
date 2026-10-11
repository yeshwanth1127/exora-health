import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { useUnsaved } from "./leave";
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
import type { Chart, Patient, PatientDetail } from "./types";

export function PatientLookup({
  onSelect,
}: {
  onSelect: (patient: Patient) => void;
}) {
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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          aria-label="Patient search"
          placeholder="Type a name, MRN or phone"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <ErrorMessage text={result.error} />
      {result.loading && <p className="text-sm">Searching…</p>}
      {result.data?.items.map((p) => (
        <Button
          key={p.patientId}
          type="button"
          variant="outline"
          className="h-auto w-full justify-between py-3"
          disabled={p.status !== "active"}
          onClick={() => onSelect(p)}
        >
          <span className="text-left">
            <span className="block">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {p.mrn} · {p.phone ?? "No phone recorded"}
            </span>
          </span>
          <span>Select</span>
        </Button>
      ))}
      {search.length >= 2 && result.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No match. Check the details before registering a new patient.
        </p>
      )}
    </div>
  );
}
export function RegisterPatient({
  onCreated,
}: {
  onCreated: (patient: Patient) => void;
}) {
  const { facility } = useWorkspace(),
    cmd = useCommand();
  const [givenName, setGivenName] = useState(""),
    [familyName, setFamilyName] = useState(""),
    [phone, setPhone] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [sex, setSex] = useState("unknown");
  useUnsaved(!!(givenName || familyName || phone || birthDate) || cmd.unknown);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
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
        if (result)
          onCreated({
            patientId: result.patientId,
            mrn: result.mrn,
            name: `${givenName} ${familyName}`.trim(),
            phone: phone || null,
            birthDate: birthDate || null,
            sex,
            status: "active",
          });
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field title="Given name" id="given-name">
          <Input
            id="given-name"
            required
            maxLength={100}
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
          />
        </Field>
        <Field title="Family name" id="family-name">
          <Input
            id="family-name"
            maxLength={100}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </Field>
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
      <Field title="Date of birth (optional)" id="birth-date">
        <Input
          id="birth-date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </Field>
      <Field title="Phone (optional, with country code)" id="patient-phone">
        <Input
          id="patient-phone"
          type="tel"
          placeholder="+919876543210"
          pattern="\+[1-9][0-9]{6,14}"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <ErrorMessage text={cmd.error} />
      <Button type="submit" disabled={cmd.busy || !givenName.trim()}>
        {cmd.busy ? "Registering…" : "Register patient"}
      </Button>
    </form>
  );
}
export function Patients() {
  const { can, facility } = useWorkspace();
  const [selected, setSelected] = useState<Patient | null>(null),
    [register, setRegister] = useState(false),
    [registered, setRegistered] = useState(0);
  return (
    <>
      <PageTitle
        title="Patients"
        description="Find the right patient before booking or recording an arrival."
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
          <PatientLookup onSelect={setSelected} />
        </CardContent>
      </Card>
      {/* Remounting starts the list again at page 1 for a new clinic or a new registration. */}
      <ClinicPatients key={`${facility.facilityId}:${registered}`} onSelect={setSelected} />
      <Sheet open={register} onOpenChange={setRegister}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Register patient</SheetTitle>
            <SheetDescription>
              Search for an existing record first. Registration creates a new
              MRN.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <RegisterPatient
              onCreated={(p) => {
                setRegister(false);
                setRegistered((n) => n + 1);
                setSelected(p);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent className="overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{selected.name}</SheetTitle>
              <SheetDescription>{selected.mrn}</SheetDescription>
            </SheetHeader>
            <PatientRecord patientId={selected.patientId} />
          </SheetContent>
        </Sheet>
      )}
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
                <TableRow
                  key={p.patientId}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => onSelect(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(p);
                  }}
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.mrn}</TableCell>
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
function PatientRecord({ patientId }: { patientId: string }) {
  const { can } = useWorkspace();
  const detail = useQuery<PatientDetail>(`/v1/patients/${patientId}`);
  const [chart, setChart] = useState(false),
    [editing, setEditing] = useState(false);
  const d = detail.data;
  const address = d?.address
    ? [d.address.line1, d.address.line2, d.address.city, d.address.district, d.address.pincode].filter(Boolean).join(", ")
    : "";
  return (
    <div className="p-6 space-y-5">
      <LoadingState {...detail}>
        {d && editing ? (
          <EditPatient
            key={d.version}
            d={d}
            onDone={(saved) => {
              setEditing(false);
              if (saved) void detail.refresh();
            }}
          />
        ) : (
          d && (
            <>
              <p className="text-sm">
                {label(d.sex)} · {d.birthDate ?? "Date of birth not recorded"}
                {d.birthDateEstimated ? " (estimated)" : ""}
              </p>
              {d.contacts.map((c) => (
                <p key={`${c.kind}:${c.value}`} className="text-sm">
                  {label(c.kind)}: {c.value}
                </p>
              ))}
              {address && <p className="text-sm">Address: {address}</p>}
              {[
                ["Preferred language", d.preferredLanguage],
                ["Blood group", d.bloodGroup],
                ["Marital status", d.maritalStatus && label(d.maritalStatus)],
                ["Occupation", d.occupation],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <p key={k as string} className="text-sm">
                    {k}: {v}
                  </p>
                ))}
              {d.status === "merged" ? (
                <Hint>This record was merged into another one; edit the surviving record.</Hint>
              ) : (
                can("patients.update") && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                )
              )}
            </>
          )
        )}
        {can("clinical.read") && (
          <Button variant="outline" onClick={() => setChart((v) => !v)}>
            {chart ? "Hide chart" : "Open patient chart"}
          </Button>
        )}
        {chart && <PatientChart patientId={patientId} />}
      </LoadingState>
    </div>
  );
}
export function PatientChart({
  patientId,
  editable = true,
}: {
  patientId: string;
  editable?: boolean;
}) {
  const result = useQuery<Chart>(`/v1/patients/${patientId}/chart`);
  if (needsCareAccess(result.failure))
    return <BreakGlass patientId={patientId} onGranted={result.refresh} />;
  return (
    <LoadingState {...result}>
      {result.data && (
        <div className="space-y-5">
          <AllergiesProblems
            patientId={patientId}
            allergies={result.data.allergies}
            problems={result.data.problems}
            editable={editable}
            onChanged={result.refresh}
          />
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
            <p className="text-sm text-muted-foreground">No vitals recorded.</p>
          )}
          <h3 className="font-semibold">Recent encounters</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Encounter</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.encounters.map((e) => (
                <TableRow key={e.encounterId}>
                  <TableCell>{e.encounterNo}</TableCell>
                  <TableCell>{e.attendingName}</TableCell>
                  <TableCell>
                    <Status value={e.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.data.encounters.length === 0 && (
            <Empty>No encounters recorded.</Empty>
          )}
        </div>
      )}
    </LoadingState>
  );
}

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MARITAL = ["single", "married", "divorced", "widowed", "separated", "unknown"];

/** Demographics, primary phone and email, and home address; the API refuses a stale form (409). */
function EditPatient({ d, onDone }: { d: PatientDetail; onDone: (saved: boolean) => void }) {
  const cmd = useCommand();
  const contact = (kind: string) => d.contacts.find((c) => c.kind === kind && c.is_primary)?.value ?? d.contacts.find((c) => c.kind === kind)?.value ?? "";
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
  const set = (k: keyof typeof start) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  useUnsaved(dirty || cmd.unknown);
  const problems = [
    !f.givenName.trim() && "Enter the given name.",
    f.phone && !E164.test(f.phone) && "Use the international phone format, e.g. +919876543210.",
    f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) && "Check the email address.",
    f.pincode && !PINCODE.test(f.pincode) && "A pincode is 6 digits.",
    f.stateCode && !/^[0-9]{2}$/.test(f.stateCode) && "The state code is 2 digits (Karnataka is 29).",
  ].filter(Boolean) as string[];
  const addressKeys = ["line1", "line2", "city", "district", "stateCode", "pincode"] as const;
  const addressChanged = addressKeys.some((k) => f[k] !== start[k]);
  const text = (k: keyof typeof start, title: string, props: Record<string, unknown> = {}) => (
    <Field title={title} id={`pt-${k}`}>
      <Input id={`pt-${k}`} value={String(f[k])} onChange={(e) => set(k)(e.target.value)} {...props} />
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
        const before = { ...start, bloodGroup: start.bloodGroup === "none" ? null : start.bloodGroup, maritalStatus: start.maritalStatus === "none" ? null : start.maritalStatus };
        const body = {
          version: d.version,
          ...changedFields(before, fields),
          ...(addressChanged
            ? { address: Object.fromEntries(addressKeys.map((k) => [k, blankToNull(f[k])])) }
            : {}),
        };
        if (await cmd.run(`/v1/patients/${d.patientId}`, body, false, "PATCH")) onDone(true);
      }}
    >
      <h3 className="font-semibold">Edit details</h3>
      <div className="grid grid-cols-2 gap-3">
        {text("givenName", "Given name", { maxLength: 100, required: true })}
        {text("familyName", "Family name", { maxLength: 100 })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field title="Sex" id="pt-sex">
          <Choice label="Sex" value={f.sex} onChange={set("sex")} options={["unknown", "female", "male", "other"].map((v) => ({ value: v, label: label(v) }))} />
        </Field>
        {text("birthDate", "Date of birth", { type: "date" })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.birthDateEstimated} onChange={(e) => set("birthDateEstimated")(e.target.checked)} />
        Date of birth is estimated
      </label>
      <div className="grid grid-cols-2 gap-3">
        {text("phone", "Phone (with country code)", { type: "tel", placeholder: "+919876543210" })}
        {text("email", "Email", { type: "email", maxLength: 254 })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text("preferredLanguage", "Preferred language", { maxLength: 40 })}
        {text("occupation", "Occupation", { maxLength: 80 })}
        <Field title="Blood group" id="pt-blood">
          <Choice label="Blood group" value={f.bloodGroup} onChange={set("bloodGroup")} options={[{ value: "none", label: "Not recorded" }, ...BLOOD.map((v) => ({ value: v, label: v }))]} />
        </Field>
        <Field title="Marital status" id="pt-marital">
          <Choice label="Marital status" value={f.maritalStatus} onChange={set("maritalStatus")} options={[{ value: "none", label: "Not recorded" }, ...MARITAL.map((v) => ({ value: v, label: label(v) }))]} />
        </Field>
      </div>
      <h4 className="text-sm font-medium">Home address</h4>
      {text("line1", "Address line 1", { maxLength: 200 })}
      {text("line2", "Address line 2", { maxLength: 200 })}
      <div className="grid grid-cols-2 gap-3">
        {text("city", "City", { maxLength: 80 })}
        {text("district", "District", { maxLength: 80 })}
        {text("stateCode", "State code", { inputMode: "numeric", maxLength: 2 })}
        {text("pincode", "Pincode", { inputMode: "numeric", maxLength: 6 })}
      </div>
      <p className="text-xs text-muted-foreground">Earlier phone numbers and addresses stay on record. The change is logged with your name.</p>
      {problems.map((x) => (
        <p key={x} className="text-sm text-destructive">{x}</p>
      ))}
      <ErrorMessage text={isStale(cmd.failure) ? "Someone else changed this patient first. Close and reopen to see their change." : cmd.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={cmd.busy || !dirty || problems.length > 0}>
          {cmd.busy ? "Saving…" : "Save details"}
        </Button>
        <Button type="button" variant="ghost" disabled={cmd.busy} onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
