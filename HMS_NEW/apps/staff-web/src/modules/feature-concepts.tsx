import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Gift,
  Monitor,
  Settings2,
  ShieldCheck,
  Ticket,
  UserRound,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Field, Choice, Notice, PageTitle } from "@/components/workspace";

// Independent synthetic concepts: no appointment, provider, patient or reward mutations.
type OnlineVisit = {
  id: string;
  patient: string;
  doctor: string;
  time: string;
  duration: string;
  state: "Patient waiting" | "Scheduled" | "Needs call link" | "Completed";
  kind: string;
};
const visits: OnlineVisit[] = [
  {
    id: "VIDEO-001",
    patient: "Maya Rao",
    doctor: "Dr. Ananya Sharma",
    time: "10:00 am",
    duration: "20 min",
    state: "Patient waiting",
    kind: "Follow-up",
  },
  {
    id: "VIDEO-002",
    patient: "Kabir Shah",
    doctor: "Dr. Kavya Reddy",
    time: "10:30 am",
    duration: "40 min",
    state: "Scheduled",
    kind: "Consultation",
  },
  {
    id: "VIDEO-003",
    patient: "Leena Das",
    doctor: "Dr. Ananya Sharma",
    time: "11:10 am",
    duration: "25 min",
    state: "Needs call link",
    kind: "Follow-up",
  },
  {
    id: "VIDEO-004",
    patient: "Nikhil Jain",
    doctor: "Dr. Arjun Nair",
    time: "12:00 pm",
    duration: "20 min",
    state: "Scheduled",
    kind: "Consultation",
  },
  {
    id: "VIDEO-005",
    patient: "Isha Menon",
    doctor: "Dr. Ananya Sharma",
    time: "9:00 am",
    duration: "20 min",
    state: "Completed",
    kind: "Follow-up",
  },
];
function PreviewLabel() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <Badge variant="outline">Design preview</Badge>
      <span>
        Fictional records · illustrative states · no calls or benefits are
        activated
      </span>
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
      aria-hidden="true"
    >
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function Status({ state }: { state: OnlineVisit["state"] }) {
  return (
    <Badge
      variant="outline"
      className={
        state === "Patient waiting"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : state === "Needs call link"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "text-muted-foreground"
      }
    >
      {state === "Patient waiting" && (
        <span className="size-1.5 rounded-full bg-blue-600" />
      )}
      {state}
    </Badge>
  );
}
function Teleconsultations() {
  const [filter, setFilter] = useState("Upcoming"),
    [query, setQuery] = useState(""),
    [doctor, setDoctor] = useState("all");
  const [selected, setSelected] = useState<OnlineVisit | null>(null),
    [patientView, setPatientView] = useState(false),
    [setup, setSetup] = useState(false);
  const visible = visits.filter(
    (v) =>
      (filter === "All" ||
        (filter === "Upcoming"
          ? v.state !== "Completed"
          : v.state === filter)) &&
      (doctor === "all" || v.doctor === doctor) &&
      `${v.patient} ${v.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const waiting = visits[0];
  return (
    <>
      <PreviewLabel />
      <PageTitle
        title="Teleconsultations"
        action={
          <Button variant="outline" onClick={() => setSetup(true)}>
            <Settings2 />
            Call setup
          </Button>
        }
      />
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 mb-8 border-y py-7">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-5">
            <span className="size-2 rounded-full bg-blue-600" />
            NEXT ONLINE VISIT · SAMPLE DAY
          </div>
          <div className="flex items-start gap-4">
            <Avatar name={waiting.patient} />
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">
                {waiting.patient}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {waiting.kind} with {waiting.doctor}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 my-5 text-sm">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 text-muted-foreground" />
              10:00–10:20 am IST
            </span>
            <Status state={waiting.state} />
          </div>
          <Button
            onClick={() => {
              setPatientView(false);
              setSelected(waiting);
            }}
          >
            <Video />
            Preview call handoff
            <ArrowRight />
          </Button>
        </div>
        <div className="lg:border-l lg:pl-8 flex flex-col justify-center">
          <h3 className="text-sm font-semibold mb-4">
            Keep reception in the loop
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground mb-5">
            See which patients are waiting, which calls are ready, and which
            appointments still need a link.
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-semibold tabular-nums">4</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upcoming visits
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">1</p>
              <p className="text-xs text-muted-foreground mt-1">
                Patient waiting
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">1</p>
              <p className="text-xs text-muted-foreground mt-1">Link needed</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-5">
        <div>
          <h2 className="font-semibold">Online appointment queue</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Illustrative 10 October 2026 · India Standard Time
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field label="Find appointment" id="online-search">
            <Input
              id="online-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Patient or reference…"
            />
          </Field>
          <Choice
            label="Doctor"
            value={doctor}
            onChange={setDoctor}
            options={[
              ["all", "All doctors"],
              ...[...new Set(visits.map((v) => v.doctor))].map(
                (d) => [d, d] as [string, string],
              ),
            ]}
          />
        </div>
      </div>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-5">
          <TabsTrigger value="Upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="Patient waiting">Waiting</TabsTrigger>
          <TabsTrigger value="Needs call link">Needs link</TabsTrigger>
          <TabsTrigger value="All">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="border rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[100px_1.4fr_1.3fr_1fr_140px] gap-4 px-5 py-3 bg-muted/40 text-xs text-muted-foreground">
          <span>Time · IST</span>
          <span>Patient</span>
          <span>Doctor</span>
          <span>Call status</span>
          <span className="text-right">Action</span>
        </div>
        {visible.map((visit) => (
          <div
            key={visit.id}
            className="grid md:grid-cols-[100px_1.4fr_1.3fr_1fr_140px] items-center gap-4 px-5 py-5 border-t first:border-t-0"
          >
            <div>
              <p className="text-sm font-medium tabular-nums">{visit.time}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {visit.duration}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={visit.patient} />
              <div>
                <p className="text-sm font-medium">{visit.patient}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {visit.kind} · {visit.id}
                </p>
              </div>
            </div>
            <p className="text-sm">{visit.doctor}</p>
            <div>
              <Status state={visit.state} />
            </div>
            <Button
              variant="outline"
              className="md:justify-self-end"
              onClick={() => {
                setPatientView(false);
                setSelected(visit);
              }}
            >
              Review
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ))}
        {!visible.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No sample appointments match these filters.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        A waiting indicator would come from patient check-in or the video
        provider. An appointment status alone cannot tell us who is in the room.
      </p>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {patientView ? "Patient waiting room" : "Online appointment"}
            </SheetTitle>
            <SheetDescription>
              Interaction preview · no video room is opened
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="p-5 space-y-6">
              {patientView ? (
                <>
                  <div className="rounded-xl bg-zinc-950 text-white p-6">
                    <Video className="size-5 mb-8" />
                    <p className="text-xs text-zinc-400 mb-2">
                      AVOCADO HEALTH · ONLINE VISIT
                    </p>
                    <h2 className="text-xl font-semibold">
                      You're in the right place.
                    </h2>
                    <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
                      Your appointment is with {selected.doctor} at{" "}
                      {selected.time} IST. Join when you are ready; your doctor
                      will let you in.
                    </p>
                  </div>
                  <div className="space-y-4 text-sm">
                    <p className="flex items-center gap-3">
                      <Check className="size-4" />
                      Confirm your appointment
                    </p>
                    <p className="flex items-center gap-3">
                      <Monitor className="size-4" />
                      Check your camera and microphone
                    </p>
                    <p className="flex items-center gap-3">
                      <ShieldCheck className="size-4" />
                      Wait for your doctor to admit you
                    </p>
                  </div>
                  <Notice
                    title="Device check preview"
                    text="The live flow will request camera and microphone access here. This concept does not access either device."
                  />
                  <Button
                    variant="outline"
                    onClick={() => setPatientView(false)}
                  >
                    Back to staff view
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex gap-3 items-center">
                    <Avatar name={selected.patient} />
                    <div>
                      <h3 className="font-semibold">{selected.patient}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selected.id} · {selected.kind}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs mb-1">
                        Doctor
                      </dt>
                      <dd>{selected.doctor}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-1">
                        Appointment
                      </dt>
                      <dd>
                        {selected.time} IST · {selected.duration}
                      </dd>
                    </div>
                  </dl>
                  <Status state={selected.state} />
                  {selected.state === "Needs call link" ? (
                    <Notice
                      title="This appointment needs a call link"
                      text="Once a video provider is connected, the clinic can create a private room for this appointment. Reception can see when the patient link is ready."
                    />
                  ) : selected.state === "Completed" ? (
                    <Notice
                      title="Consultation completed"
                      text="The call entry is closed. Appointment details and any follow-up remain available in the clinic workspace."
                    />
                  ) : (
                    <div className="rounded-xl border p-5 space-y-4">
                      <div className="flex gap-3">
                        <Video className="size-5 shrink-0" />
                        <div>
                          <h3 className="text-sm font-semibold">
                            Open video call
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                            The doctor opens a private room in a new tab. The
                            patient uses a separate link and waits for
                            admission.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Proposed flow. There is no provider room attached to
                        these fictional appointments.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setPatientView(true)}
                      >
                        <UserRound />
                        Preview patient waiting room
                      </Button>
                    </div>
                  )}
                  <details className="text-sm border-t pt-4">
                    <summary className="cursor-pointer font-medium">
                      What reception can manage
                    </summary>
                    <p className="mt-3 text-muted-foreground leading-relaxed">
                      Prepare the patient link, confirm delivery, reschedule the
                      appointment, and help with joining. Clinical admission and
                      ending a consultation belong to the doctor.
                    </p>
                  </details>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={setup} onOpenChange={setSetup}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Choose the call experience</SheetTitle>
            <SheetDescription>
              Two approaches to discuss before connecting a provider.
            </SheetDescription>
          </SheetHeader>
          <div className="p-5 space-y-6">
            <div className="border rounded-xl p-5">
              <Badge variant="secondary" className="mb-3">
                Suggested first version
              </Badge>
              <h3 className="font-semibold flex gap-2 items-center">
                <ExternalLink className="size-4" />
                Open a private video room
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                Keep the appointment queue here. Launch the provider's call
                interface in a new tab, with appointment-specific access for the
                doctor and patient.
              </p>
            </div>
            <div className="border rounded-xl p-5">
              <h3 className="font-semibold flex gap-2 items-center">
                <Monitor className="size-4" />
                Call inside the workspace
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                Embed the same private room beside appointment details. Useful
                once the call flow is reliable and doctors need more context on
                screen.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Provider choice and join permissions would be administrator
              settings. Recording stays a separate decision.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type Program = {
  name: string;
  benefit: string;
  amount: string;
  expiry: string;
};
const initialProgram: Program = {
  name: "Avocado Care",
  benefit: "10% off eligible consultations",
  amount: "₹499 / year",
  expiry: "10 October 2027",
};
const members = [
  {
    name: "Maya Rao",
    id: "CARE-001",
    joined: "10 Oct 2026",
    status: "Active",
    value: "2 benefits used",
  },
  {
    name: "Leena Das",
    id: "CARE-002",
    joined: "02 Oct 2026",
    status: "Active",
    value: "1 benefit used",
  },
  {
    name: "Kabir Shah",
    id: "CARE-003",
    joined: "12 Oct 2025",
    status: "Expiring soon",
    value: "3 benefits used",
  },
  {
    name: "Nikhil Jain",
    id: "CARE-004",
    joined: "15 Sep 2025",
    status: "Expired",
    value: "2 benefits used",
  },
];
function LoyaltyProgram() {
  const [tab, setTab] = useState("program"),
    [program, setProgram] = useState(initialProgram);
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(initialProgram),
    [attempted, setAttempted] = useState(false);
  const [query, setQuery] = useState(""),
    [member, setMember] = useState<(typeof members)[number] | null>(null);
  const benefits = [
    program.benefit,
    "One care-navigation session",
    "Benefits at participating clinic locations",
  ];
  const invalid =
    !draft.name.trim() ||
    !draft.benefit.trim() ||
    !draft.amount.trim() ||
    !draft.expiry.trim();
  return (
    <>
      <PreviewLabel />
      <PageTitle
        title="Loyalty program"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setDraft(program);
              setAttempted(false);
              setEditing(true);
            }}
          >
            <Settings2 />
            Edit sample program
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="patient">Patient view</TabsTrigger>
        </TabsList>
        <TabsContent value="program">
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10">
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wider mb-4">
                ONE CLEAR OFFER
              </p>
              <h2 className="text-3xl font-semibold tracking-tight leading-tight">
                Benefits patients
                <br />
                can understand.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-4 max-w-sm">
                Keep the value, eligibility and expiry together. Staff see the
                rules; patients see exactly what they can use.
              </p>
              <Badge variant="outline" className="mt-8">
                Clinic membership benefits
              </Badge>
              <p className="text-xs text-muted-foreground mt-3">
                Sample rules and prices for discussion. Nothing is published.
              </p>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <div className="p-6 bg-zinc-950 text-white flex justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-400 mb-4">AVOCADO HEALTH</p>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    {program.name}
                  </h3>
                  <p className="text-sm text-zinc-300 mt-2">
                    A little more support, throughout the year.
                  </p>
                </div>
                <Ticket className="size-7 shrink-0 text-zinc-400" />
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between gap-4 mb-6">
                  <p className="font-semibold text-lg">{program.amount}</p>
                  <Badge variant="outline">Sample offer</Badge>
                </div>
                <ul className="space-y-4">
                  {benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex gap-3 items-start text-sm"
                    >
                      <Check className="size-4 mt-0.5 shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <div className="border-t mt-6 pt-5">
                  <h4 className="text-sm font-medium">
                    Terms patients need to see
                  </h4>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Eligible services and participating doctors are listed
                    before joining. Exclusions, expiry and refund terms remain
                    visible when a benefit is used.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => setTab("patient")}
                >
                  Preview what patients see
                  <ArrowRight />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-10 border-t pt-7">
            {[
              [
                "Administrator owns the rules",
                "Pricing, eligible services and expiry are configured by the clinic administrator.",
              ],
              [
                "Staff see the available benefit",
                "Reception can check membership and eligibility before applying a benefit.",
              ],
              [
                "Every use has a record",
                "A patient can see what was used, when, and how much remains.",
              ],
            ].map(([title, detail]) => (
              <div key={title}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="members">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-5">
            <div>
              <h2 className="font-semibold">Member directory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fictional memberships for the screen preview.
              </p>
            </div>
            <Field label="Find member" id="member-search">
              <Input
                id="member-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or member ID…"
              />
            </Field>
          </div>
          <div className="border rounded-xl overflow-hidden">
            {members
              .filter((m) =>
                `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 border-b last:border-0"
                >
                  <div className="flex gap-3 items-center">
                    <Avatar name={m.name} />
                    <div>
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.id} · Joined {m.joined}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                      {m.value}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        m.status === "Expiring soon"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : ""
                      }
                    >
                      {m.status}
                    </Badge>
                    <Button variant="ghost" onClick={() => setMember(m)}>
                      View member
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            {!members.some((m) =>
              `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p className="p-8 text-sm text-muted-foreground text-center">
                No sample members match this search.
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="patient">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 items-start">
            <div className="max-w-lg order-2 lg:order-1">
              <p className="text-xs text-muted-foreground tracking-wider mb-4">
                PATIENT EXPERIENCE
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Lead with what
                <br />
                they can use today.
              </h2>
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                This view could live in the patient portal and open from
                WhatsApp after sign-in. The first screen answers: What do I
                have? Where can I use it? When does it expire?
              </p>
              <ol className="mt-7 space-y-5">
                {[
                  [
                    "01",
                    "A clear membership benefit",
                    "Show the actual value before the program's marketing.",
                  ],
                  [
                    "02",
                    "Eligibility at the point of use",
                    "Explain which services and clinics accept it.",
                  ],
                  [
                    "03",
                    "An honest history",
                    "Show benefits used, remaining allowances and expiry.",
                  ],
                ].map(([n, title, detail]) => (
                  <li key={n} className="flex gap-4">
                    <span className="text-xs text-muted-foreground pt-1">
                      {n}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => setTab("program")}
              >
                Review program details
              </Button>
            </div>
            <div className="border rounded-2xl overflow-hidden bg-background shadow-sm order-1 lg:order-2">
              <div className="p-5 border-b flex justify-between">
                <span className="text-sm font-semibold">Avocado Health</span>
                <Badge variant="outline">Patient preview</Badge>
              </div>
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-5">
                  Hello, Maya
                </p>
                <div className="rounded-xl bg-zinc-950 text-white p-6">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-zinc-400">
                      {program.name} · MEMBERSHIP
                    </p>
                    <Gift className="size-5 text-zinc-400" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight mt-8">
                    You're a member.
                  </p>
                  <p className="text-sm text-zinc-300 mt-3">
                    {program.benefit}
                  </p>
                  <p className="text-xs text-zinc-400 mt-7">
                    Valid until {program.expiry}
                  </p>
                </div>
                <h3 className="font-semibold text-sm mt-7 mb-4">
                  Your benefits
                </h3>
                <ul className="space-y-4">
                  {benefits.map((b) => (
                    <li key={b} className="flex gap-3 text-sm">
                      <Check className="size-4 mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <details className="border-y py-4 mt-6 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Where can I use this?
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    At participating Avocado Health clinics, for services
                    included in your plan. Reception confirms eligibility before
                    payment. Final participating clinics and services will be
                    listed here when your clinic publishes its program.
                  </p>
                </details>
                <h3 className="font-semibold text-sm mt-6">Recent activity</h3>
                <div className="flex justify-between gap-4 text-sm mt-4">
                  <div>
                    <p>Consultation benefit used</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      10 October 2026 · Sample entry
                    </p>
                  </div>
                  <span>₹80 saved</span>
                </div>
                <p className="text-xs text-muted-foreground mt-6">
                  Illustrative benefits only. Your clinic would confirm the
                  final rules before enrolment.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit sample membership</SheetTitle>
            <SheetDescription>
              Administrator concept · changes stay in this preview until reload
            </SheetDescription>
          </SheetHeader>
          <form
            className="p-5 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setAttempted(true);
              if (!invalid) {
                setProgram(draft);
                setEditing(false);
              }
            }}
          >
            {(
              [
                ["name", "Program name"],
                ["benefit", "Main patient benefit"],
                ["amount", "Membership price"],
                ["expiry", "Example member expiry"],
              ] as [keyof Program, string][]
            ).map(([key, label]) => (
              <Field
                key={key}
                id={`program-${key}`}
                label={label}
                error={
                  attempted && !draft[key].trim()
                    ? `Enter ${label.toLowerCase()}.`
                    : ""
                }
              >
                <Input
                  id={`program-${key}`}
                  value={draft[key]}
                  maxLength={120}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <p className="text-xs text-muted-foreground">
              Sample configuration for the design discussion. No patient is
              enrolled and no payment is collected.
            </p>
            <Button type="submit">Apply to preview</Button>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!member}
        onOpenChange={(open) => {
          if (!open) setMember(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Member details</SheetTitle>
            <SheetDescription>
              Fictional member record · membership concept
            </SheetDescription>
          </SheetHeader>
          {member && (
            <div className="p-5 space-y-6">
              <div className="flex gap-3 items-center">
                <Avatar name={member.name} />
                <div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-xs text-muted-foreground">{member.id}</p>
                </div>
              </div>
              <Badge variant="outline">{member.status}</Badge>
              <div className="border-y py-5">
                <p className="text-xs text-muted-foreground">Program</p>
                <p className="font-medium mt-1">{program.name}</p>
                <p className="text-sm text-muted-foreground mt-3">
                  {member.value} · Joined {member.joined}
                </p>
              </div>
              <h3 className="text-sm font-semibold">Benefit history</h3>
              <div className="text-sm">
                <p>Consultation benefit used</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Sample ledger entry · eligible visit · ₹80 saved
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                The live ledger would show every benefit use and adjustment
                against a specific appointment, with the responsible staff
                member.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
export function FeatureConcepts({ page }: { page: string }) {
  return page === "teleconsultation" ? (
    <Teleconsultations />
  ) : (
    <LoyaltyProgram />
  );
}
