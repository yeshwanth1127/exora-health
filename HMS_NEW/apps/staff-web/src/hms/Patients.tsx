import { useState } from "react";
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
  const result = useQuery<{ items: Patient[] }>(
    search
      ? `/v1/patients?${query(search.startsWith("+") ? { phone: search, limit: 20 } : { q: search, limit: 20 })}`
      : null,
  );
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(text.trim());
        }}
      >
        <Input
          aria-label="Patient search"
          placeholder="Name, MRN or +91 phone"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={text.trim().length < 2}
        >
          <Search />
          Search
        </Button>
      </form>
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
      {search && result.data?.items.length === 0 && (
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
  const { can } = useWorkspace();
  const [selected, setSelected] = useState<Patient | null>(null),
    [register, setRegister] = useState(false);
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
function PatientRecord({ patientId }: { patientId: string }) {
  const { can } = useWorkspace();
  const detail = useQuery<PatientDetail>(`/v1/patients/${patientId}`);
  const [chart, setChart] = useState(false);
  return (
    <div className="p-6 space-y-5">
      <LoadingState {...detail}>
        <p className="text-sm">
          {detail.data &&
            `${label(detail.data.sex)} · ${detail.data.birthDate ?? "Date of birth not recorded"}`}
        </p>
        {detail.data?.contacts.map((c) => (
          <p key={`${c.kind}:${c.value}`} className="text-sm">
            {label(c.kind)}: {c.value}
          </p>
        ))}
        <Hint>Demographic editing is not available yet.</Hint>
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
