import { OriginalResourceContext, isDraft } from "@/components/resource-source";
import { confirmLeave } from "@/hms/leave";
import { WeeklyHours } from "./weekly-hours";
import { useContext, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarDays,
  Clock3,
  CalendarPlus,
  LockKeyhole,
  Video,
} from "lucide-react";
import {
  Action,
  Choice,
  Field,
  Resource,
  usePermissions,
  useApi,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { type Catalogue, dateTime } from "@/lib/api";
import {
  ScheduleRangeActions,
  type ScheduleRange,
} from "./schedule-range-actions";
import {
  clinicToday,
  clockLabel,
  minute,
  type Doctor,
  type TimeBlock,
} from "./clinic-types";
import type { DeskAppointment } from "./NurseDesk";
import { AppointmentActions } from "./appointment-actions";

export type Period = {
  kind: "available" | "booked" | "blocked" | "held";
  starts_at: string;
  ends_at: string;
  branch_id: string | null;
  consultation_type?: string;
  reason?: string;
  expires_at?: string | null;
  appointment?: DeskAppointment | null;
  exception_id?: string;
};
type Row = {
  doctor_id: string;
  blocks: TimeBlock[];
  has_override: boolean;
  reason: string;
  periods: Period[];
  available_slots: number;
  bookings: number;
};
type Board = { day: string; as_of: string; rows: Row[] };
type Span = Period & {
  start: number;
  end: number;
  count: number;
  lane: number;
};
const states = {
  available: "Available",
  booked: "Booked",
  blocked: "Blocked",
  held: "On hold",
};
const classes = {
  available:
    "bg-background border-foreground/30 text-foreground hover:bg-muted",
  booked:
    "bg-foreground border-foreground text-background hover:bg-foreground/85",
  blocked:
    "schedule-blocked border-border text-muted-foreground hover:bg-muted",
  held: "bg-muted border-foreground/50 border-dashed text-foreground hover:bg-secondary",
};
const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const at = (value: string, day: string) =>
  (new Date(value).getTime() - new Date(`${day}T00:00:00+05:30`).getTime()) /
  60000;
const clock = (n: number) =>
  n === 1440
    ? "12:00 am +1"
    : clockLabel(
        `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`,
      );
function spans(row: Row, day: string): Span[] {
  const result: Span[] = [];
  for (const period of row.periods) {
    const start = Math.max(0, at(period.starts_at, day)),
      end = Math.min(1440, at(period.ends_at, day));
    if (end <= start) continue;
    const prior = result.at(-1);
    if (
      period.kind === "available" &&
      prior?.kind === "available" &&
      prior.end === start &&
      prior.branch_id === period.branch_id &&
      prior.consultation_type === period.consultation_type
    ) {
      prior.end = end;
      prior.ends_at = period.ends_at;
      prior.count++;
      continue;
    }
    result.push({ ...period, start, end, count: 1, lane: 0 });
  }
  const ends: number[] = [];
  for (const span of result) {
    let lane = ends.findIndex((end) => end <= span.start);
    if (lane < 0) lane = ends.length;
    span.lane = lane;
    ends[lane] = span.end;
  }
  return result;
}
export function ScheduleTimeline({
  day,
  setDay,
  ownDoctorId,
  initialDoctorId,
  initialVisitMode = "in_person",
  onDoctorProfile,
}: {
  day: string;
  setDay: (day: string) => void;
  ownDoctorId?: string;
  initialDoctorId?: string;
  initialVisitMode?: "in_person" | "virtual";
  onDoctorProfile?: (id: string) => void;
}) {
  const draft = isDraft(useContext(OriginalResourceContext));
  const api = useApi();
  const permissions = usePermissions();
  const [unblockReason, setUnblockReason] = useState("");
  const canManage =
    permissions.can("schedules.manage") ||
    permissions.can("schedule.block") ||
    permissions.can("appointments.create");
  const doctors = useResource<Doctor[]>("/api/v1/admin/doctors"),
    catalogue = useResource<Catalogue>("/api/v1/admin/catalogue");
  const [branch, setBranch] = useState(""),
    [department, setDepartment] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<{ span: Span; doctor: Doctor } | null>(
      null,
    ),
    [now, setNow] = useState(() => Date.now()),
    [scale, setScale] = useState("320"),
    [range, setRange] = useState<ScheduleRange | null>(null),
    [rangeIntent, setRangeIntent] = useState<"book" | "block" | null>(null),
    [weekly, setWeekly] = useState<Doctor | null>(null),
    [weeklyMode, setWeeklyMode] = useState<"in_person" | "virtual">(
      "in_person",
    ),
    [weeklyPicker, setWeeklyPicker] = useState(false),
    [weeklyDoctor, setWeeklyDoctor] = useState("");
  const [consumedLink, setConsumedLink] = useState("");
  const canEditWeekly = permissions.can("schedules.manage");
  const requestedLink = `${initialDoctorId}:${initialVisitMode}`;
  const requestedDoctor =
    initialDoctorId &&
    consumedLink !== requestedLink &&
    canEditWeekly &&
    catalogue.data
      ? (doctors.data?.find((d) => d.id === initialDoctorId && d.is_active) ??
        null)
      : null;
  const weeklySelection = weekly ?? requestedDoctor;
  const selectedWeeklyMode = weekly ? weeklyMode : initialVisitMode;
  const timelineViewport = useRef<HTMLDivElement>(null);
  const pendingNow = useRef(true);
  const [highlight, setHighlight] = useState<{
    doctor: string;
    start: number;
    end: number;
  } | null>(null);
  const gesture = useRef<{
    pointer: number;
    anchor: number;
    current: number;
    x: number;
    initial?: Span;
    node: HTMLDivElement;
  } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const cancel = () => {
      const g = gesture.current;
      gesture.current = null;
      setHighlight(null);
      if (g?.node.hasPointerCapture(g.pointer))
        g.node.releasePointerCapture(g.pointer);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current) cancel();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const chosenBranch =
    branch ||
    catalogue.data?.branches.find((b) => b.is_active && !b.is_virtual)?.id ||
    "all";
  const board = useResource<Board>(
    `/api/v1/admin/schedule-timeline?day=${day}${chosenBranch === "all" ? "" : `&branch_id=${encodeURIComponent(chosenBranch)}`}`,
  );
  const refreshBoard = board.refresh;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      refreshBoard();
    }, 60000);
    return () => clearInterval(timer);
  }, [refreshBoard]);
  const rows = (board.data?.rows ?? []).flatMap((row) => {
    const doctor = doctors.data?.find((d) => d.id === row.doctor_id);
    return doctor &&
      doctor.name.toLowerCase().includes(query.toLowerCase()) &&
      (department === "all" ||
        doctor.departments.some((d) => d.id === department))
      ? [{ ...row, doctor, spans: spans(row, day) }]
      : [];
  });
  const openSlots = rows.reduce((sum, row) => sum + row.available_slots, 0);
  const bookingCount = rows.reduce((sum, row) => sum + row.bookings, 0);
  const bounds = rows.flatMap((row) => [
    ...row.blocks.flatMap((b) => [
      minute(b.starts_at_local),
      minute(b.ends_at_local),
    ]),
    ...row.spans.flatMap((s) => [s.start, s.end]),
  ]);
  const current = at(new Date(now).toISOString(), day);
  const today = day === clinicToday();
  const start = Math.max(
      0,
      Math.min(
        8 * 60,
        Math.floor(
          Math.min(
            ...bounds,
            8 * 60,
            today ? Math.floor(current / 60) * 60 : 8 * 60,
          ) / 60,
        ) * 60,
      ),
    ),
    end = Math.min(
      1440,
      Math.max(
        18 * 60,
        Math.ceil(
          Math.max(
            ...bounds,
            18 * 60,
            today ? Math.ceil((current + 30) / 60) * 60 : 18 * 60,
          ) / 60,
        ) * 60,
      ),
    );
  const hours = Array.from(
    { length: (end - start) / 60 + 1 },
    (_, i) => start + i * 60,
  );
  const pct = (time: number) => `${((time - start) / (end - start)) * 100}%`;
  const showNow = today && current >= start && current <= end;
  const nowLabel = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(now));
  useEffect(() => {
    const node = timelineViewport.current;
    if (
      !pendingNow.current ||
      !showNow ||
      !node ||
      board.data?.day !== day ||
      board.loading
    )
      return;
    const x =
      228 + ((current - start) / (end - start)) * (node.scrollWidth - 248);
    node.scrollTo({
      left: Math.max(0, x - (node.clientWidth + 208) / 2),
      behavior: "instant",
    });
    pendingNow.current = false;
  }, [day, current, start, end, showNow, board.data?.day, board.loading]);
  const refresh = () => {
    board.refresh();
    doctors.refresh();
    catalogue.refresh();
  };
  const clinic = (id: string | null) =>
    id
      ? (catalogue.data?.branches.find((b) => b.id === id)?.name ??
        "Clinic unavailable")
      : "All clinics";
  const changeDay = (value: string) => {
    if (!confirmLeave()) return;
    setSelected(null);
    setRange(null);
    setHighlight(null);
    gesture.current = null;
    setDay(value);
  };
  const selectRange = (
    doctor: Doctor,
    begins: number,
    finishes: number,
    span?: Period,
    slotMinutes = 30,
    overbook = false,
    intent: "book" | "block" | null = null,
  ) => {
    setRangeIntent(intent);
    setSelected(null);
    setRange({
      doctor,
      day,
      start: begins,
      end: Math.min(1439, finishes),
      branch:
        span?.branch_id ??
        (chosenBranch === "all"
          ? (doctor.branches.find((b) =>
              catalogue.data?.branches.some(
                (c) => c.id === b.id && c.is_active && !c.is_virtual,
              ),
            )?.id ?? "")
          : chosenBranch),
      mode: span?.consultation_type,
      slotMinutes,
      overbook,
    });
  };
  const jumpToNow = () => {
    pendingNow.current = true;
    setNow(Date.now());
    changeDay(clinicToday());
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => changeDay(addDay(day, -1))}
          >
            <ChevronLeft />
          </Button>
          <Input
            aria-label="Schedule date"
            type="date"
            value={day}
            className="w-40 tabular-nums"
            onInput={(e) => {
              if (e.currentTarget.value) changeDay(e.currentTarget.value);
            }}
            onChange={(e) => {
              if (e.target.value) {
                changeDay(e.target.value);
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => changeDay(addDay(day, 1))}
          >
            <ChevronRight />
          </Button>
          <Button variant="ghost" onClick={jumpToNow}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Choice
              label="Time scale"
              value={scale}
              onChange={setScale}
              options={[
                ["180", "Compact"],
                ["320", "Meeting view"],
                ["480", "Extra space"],
              ]}
            />
          </div>
          {permissions.can("schedules.manage") && (
            <Button
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
              onClick={() => {
                setWeeklyMode("in_person");
                const active = rows.filter((r) => r.doctor.is_active);
                if (active.length === 1) setWeekly(active[0].doctor);
                else setWeeklyPicker(true);
              }}
            >
              <CalendarDays />
              Configure weekly hours
            </Button>
          )}
          {canEditWeekly && (
            <Button
              variant="outline"
              onClick={() => {
                setWeeklyMode("virtual");
                const active = rows.filter((r) => r.doctor.is_active);
                if (active.length === 1) setWeekly(active[0].doctor);
                else setWeeklyPicker(true);
              }}
            >
              <Video />
              Teleconsultation hours
            </Button>
          )}
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        </div>
      </div>
      {initialDoctorId && !canEditWeekly && (
        <p className="mb-4 text-xs text-muted-foreground">
          Publishing doctor hours requires scheduling permission at this clinic.
          Your current role can view the timeline.
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Choice
          label="Clinic"
          value={chosenBranch}
          onChange={(v) => {
            setBranch(v);
            setRange(null);
            setSelected(null);
          }}
          options={[
            ["all", "All clinics"],
            ...(catalogue.data?.branches ?? []).map(
              (b) => [b.id, b.name] as [string, string],
            ),
          ]}
        />
        <Choice
          label="Department"
          value={department}
          onChange={setDepartment}
          options={[
            ["all", "All departments"],
            ...(catalogue.data?.departments ?? []).map(
              (d) => [d.id, d.name] as [string, string],
            ),
          ]}
        />
        <div className="space-y-2">
          <label htmlFor="timeline-search" className="text-sm font-medium">
            Doctor
          </label>
          <Input
            id="timeline-search"
            type="search"
            placeholder="Find a doctor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <Resource
        loading={
          (board.loading && board.data?.day !== day) ||
          (doctors.loading && !doctors.data) ||
          (catalogue.loading && !catalogue.data)
        }
        error={board.error || doctors.error || catalogue.error}
        refresh={refresh}
      >
        <Card className="min-w-0 w-full overflow-hidden gap-0 py-0 shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 border-b">
            <div>
              <h2 className="font-semibold text-lg tracking-tight">
                {dateLabel(day)}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {rows.length} {rows.length === 1 ? "doctor" : "doctors"} ·{" "}
                {openSlots} open {openSlots === 1 ? "slot" : "slots"} ·{" "}
                {bookingCount} {bookingCount === 1 ? "booking" : "bookings"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {canManage
                  ? "Drag across a doctor's row to plan time. Click an appointment or block to inspect it."
                  : ownDoctorId
                    ? "Your schedule is marked below. Your account needs permission to book appointments or block time."
                    : "Click an appointment or block to inspect it."}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-x-4 gap-y-2 text-xs"
              aria-label="Schedule legend"
            >
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 tabular-nums"
                onClick={jumpToNow}
              >
                <Clock3 />
                Now · {nowLabel} IST
              </Button>
              {Object.entries(states).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`size-3 rounded-sm border ${classes[key as Period["kind"]]}`}
                  />
                  {label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border bg-muted"
                />
                {draft ? "Coverage unknown" : "Not bookable"}
              </span>
            </div>
          </header>
          <div
            ref={timelineViewport}
            className="min-w-0 w-full overflow-auto max-h-[65dvh] schedule-board"
            tabIndex={0}
            role="region"
            aria-label="Doctor day timeline; scroll horizontally for more times"
          >
            <div
              style={{ minWidth: 248 + ((end - start) / 60) * Number(scale) }}
            >
              <div className="grid grid-cols-[208px_1fr] sticky top-0 z-30 bg-background border-b h-14">
                <div className="sticky left-0 bg-background z-30 px-5 flex items-center text-xs font-medium text-muted-foreground border-r">
                  Doctor / time · IST
                </div>
                <div className="relative mx-5">
                  {showNow && (
                    <div
                      className="absolute top-0 z-40 pointer-events-none border-l-2 border-red-500 h-14"
                      style={{ left: pct(current) }}
                    >
                      <span className="absolute top-0 left-0 -translate-x-1/2 whitespace-nowrap rounded-b bg-red-600 px-2 py-1 text-[11px] font-medium text-white tabular-nums">
                        Now {nowLabel}
                      </span>
                    </div>
                  )}
                  {hours.map((hour) => (
                    <span
                      key={hour}
                      className="absolute top-5 text-xs tabular-nums whitespace-nowrap text-muted-foreground -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                      style={{ left: pct(hour) }}
                    >
                      {clock(hour).replace(":00", "")}
                    </span>
                  ))}
                </div>
              </div>
              {rows.map((row) => {
                const ownRow = row.doctor_id === ownDoctorId;
                const canPlan = canManage;
                const first = row.spans.find(
                  (s) =>
                    s.kind === "available" &&
                    (day !== clinicToday() || s.end > current + 5),
                );
                const rangeStart = first
                  ? Math.max(
                      first.start,
                      day === clinicToday()
                        ? Math.ceil((current + 1) / 5) * 5
                        : first.start,
                    )
                  : day === clinicToday()
                    ? Math.min(1425, Math.ceil((current + 15) / 5) * 5)
                    : 9 * 60;
                const planRange = (intent: "book" | "block" | null = null) =>
                  selectRange(
                    row.doctor,
                    rangeStart,
                    first
                      ? Math.min(
                          first.end,
                          rangeStart + (row.blocks[0]?.slot_minutes ?? 30),
                        )
                      : Math.min(1439, rangeStart + 30),
                    first,
                    row.blocks[0]?.slot_minutes,
                    false,
                    intent,
                  );
                const height = Math.max(
                  140,
                  56 + (Math.max(...row.spans.map((s) => s.lane), 0) + 1) * 64,
                );
                return (
                  <section
                    key={row.doctor_id}
                    className="grid grid-cols-[208px_1fr] border-b last:border-b-0"
                    style={{ minHeight: height }}
                    aria-label={`${row.doctor.name} schedule`}
                  >
                    <div className="sticky left-0 z-20 bg-background border-r p-4 flex flex-col justify-center gap-2">
                      <h3 className="font-medium text-sm">{row.doctor.name}</h3>
                      {ownRow && (
                        <Badge variant="outline" className="w-fit text-[11px]">
                          Your schedule
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {row.doctor.departments
                          .map((d) => d.name)
                          .join(" · ") || row.doctor.title}
                      </p>
                      <p className="text-xs tabular-nums">
                        <span
                          className={
                            row.available_slots
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {row.available_slots} open
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.bookings} booked
                        </span>
                      </p>
                      {row.has_override && (
                        <span className="text-[11px] text-muted-foreground">
                          Date-specific hours
                        </span>
                      )}
                      {permissions.can("schedules.manage") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start h-8 text-xs border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                          disabled={!row.doctor.is_active}
                          onClick={() => {
                            setWeeklyMode("in_person");
                            setWeekly(row.doctor);
                          }}
                        >
                          <CalendarDays className="size-3.5" />
                          Weekly hours
                        </Button>
                      )}
                      {(ownRow || canEditWeekly) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start h-8 text-xs"
                          disabled={!canEditWeekly || !row.doctor.is_active}
                          onClick={() => {
                            setWeeklyMode("virtual");
                            setWeekly(row.doctor);
                          }}
                        >
                          <Video className="size-3.5" />
                          Teleconsultation hours
                        </Button>
                      )}
                      {(ownRow || permissions.can("appointments.create")) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start h-8 text-xs"
                          disabled={
                            !permissions.can("appointments.create") ||
                            !row.doctor.is_active ||
                            day < clinicToday() ||
                            !first
                          }
                          onClick={() => planRange("book")}
                        >
                          <CalendarPlus className="size-3.5" />
                          Book appointment
                        </Button>
                      )}
                      {(ownRow || permissions.can("schedule.block")) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start h-8 text-xs"
                          disabled={
                            !permissions.can("schedule.block") ||
                            !row.doctor.is_active ||
                            day < clinicToday()
                          }
                          onClick={() => planRange("block")}
                        >
                          <LockKeyhole className="size-3.5" />
                          Block time
                        </Button>
                      )}
                      {ownRow &&
                        (!permissions.can("appointments.create") ||
                          !permissions.can("schedule.block")) && (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {!permissions.can("appointments.create") &&
                              "Your account cannot book appointments yet. "}
                            {!permissions.can("schedule.block") &&
                              "Your account cannot block time yet. "}
                            {!canManage &&
                              "Ask the clinic administrator to arrange access."}
                          </p>
                        )}
                    </div>
                    <div
                      className={`relative mx-5 bg-muted/30 my-3 rounded-sm select-none ${canPlan && row.doctor.is_active && day >= clinicToday() ? "cursor-crosshair" : ""}`}
                      data-timeline-row={row.doctor_id}
                      onClickCapture={(e) => {
                        if (suppressClick.current && e.detail > 0) {
                          e.stopPropagation();
                          suppressClick.current = false;
                        }
                      }}
                      onPointerDown={(e) => {
                        if (
                          !canPlan ||
                          !row.doctor.is_active ||
                          day < clinicToday() ||
                          !e.isPrimary ||
                          e.button !== 0 ||
                          e.pointerType === "touch" ||
                          gesture.current ||
                          (e.target as HTMLElement).closest("[data-no-range]")
                        )
                          return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const value = Math.max(
                          start,
                          Math.min(
                            end - 5,
                            Math.floor(
                              (start +
                                ((e.clientX - rect.left) / rect.width) *
                                  (end - start)) /
                                5,
                            ) * 5,
                          ),
                        );
                        const index = (
                          e.target as HTMLElement
                        ).closest<HTMLElement>("[data-span]")?.dataset.span;
                        gesture.current = {
                          pointer: e.pointerId,
                          anchor: value,
                          current: value,
                          x: e.clientX,
                          initial:
                            index === undefined
                              ? undefined
                              : row.spans[Number(index)],
                          node: e.currentTarget,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setHighlight({
                          doctor: row.doctor_id,
                          start: value,
                          end: value + 5,
                        });
                        e.preventDefault();
                      }}
                      onPointerMove={(e) => {
                        const g = gesture.current;
                        if (!g || g.pointer !== e.pointerId) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        g.current = Math.max(
                          start,
                          Math.min(
                            Math.min(end, 1435),
                            Math.round(
                              (start +
                                ((e.clientX - rect.left) / rect.width) *
                                  (end - start)) /
                                5,
                            ) * 5,
                          ),
                        );
                        setHighlight({
                          doctor: row.doctor_id,
                          start: Math.min(g.anchor, g.current),
                          end: Math.max(g.anchor + 5, g.current),
                        });
                      }}
                      onPointerUp={(e) => {
                        const g = gesture.current;
                        if (!g || g.pointer !== e.pointerId) return;
                        gesture.current = null;
                        suppressClick.current = true;
                        setHighlight(null);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        const clicked = Math.abs(e.clientX - g.x) < 4;
                        const slot = clicked
                          ? row.periods.find(
                              (p) =>
                                p.kind === "available" &&
                                at(p.starts_at, day) <= g.anchor &&
                                at(p.ends_at, day) > g.anchor,
                            )
                          : undefined;
                        selectRange(
                          row.doctor,
                          slot
                            ? at(slot.starts_at, day)
                            : Math.min(g.anchor, g.current),
                          slot
                            ? at(slot.ends_at, day)
                            : clicked
                              ? Math.min(end, g.anchor + 30)
                              : Math.max(g.anchor + 5, g.current),
                          g.initial ?? slot,
                          row.blocks[0]?.slot_minutes,
                        );
                      }}
                      onPointerCancel={() => {
                        gesture.current = null;
                        setHighlight(null);
                      }}
                      onLostPointerCapture={() => {
                        gesture.current = null;
                        setHighlight(null);
                      }}
                    >
                      {hours.map((hour) => (
                        <span
                          key={hour}
                          className="absolute inset-y-0 border-l border-border/60 pointer-events-none"
                          style={{ left: pct(hour) }}
                        />
                      ))}
                      {row.blocks.map((b, i) => (
                        <div
                          key={i}
                          className="absolute top-1 h-2 rounded-sm bg-foreground/15"
                          style={{
                            left: pct(minute(b.starts_at_local)),
                            width: `${((minute(b.ends_at_local) - minute(b.starts_at_local)) / (end - start)) * 100}%`,
                          }}
                          title={`Published hours: ${clockLabel(b.starts_at_local)}–${clockLabel(b.ends_at_local)} · ${clinic(b.branch_id)}`}
                        />
                      ))}
                      {!row.blocks.length && !row.spans.length && (
                        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          {draft
                            ? "Hours not available in this read model"
                            : "No hours scheduled"}
                        </p>
                      )}
                      {row.spans.map((span, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className={`absolute h-14 rounded-md justify-start overflow-hidden px-3 text-xs shadow-none ${classes[span.kind]} ${span.kind === "available" && canPlan ? "cursor-crosshair" : ""}`}
                          data-span={i}
                          data-no-range={
                            span.kind === "available" ? undefined : "true"
                          }
                          style={{
                            left: pct(span.start),
                            width: `${((span.end - span.start) / (end - start)) * 100}%`,
                            top: 32 + span.lane * 64,
                          }}
                          aria-label={`${row.doctor.name}: ${states[span.kind]}, ${clock(span.start)} to ${clock(span.end)}${span.appointment ? `, ${span.appointment.patient_name}` : ""}${span.appointment?.booked_by ? `, booked by ${span.appointment.booked_by.name}` : ""}`}
                          title={`${states[span.kind]} · ${clock(span.start)}–${clock(span.end)} · ${clinic(span.branch_id)}`}
                          onClick={() => {
                            if (span.kind === "available" && canPlan)
                              selectRange(
                                row.doctor,
                                span.start,
                                span.end,
                                span,
                                row.blocks[0]?.slot_minutes,
                              );
                            else setSelected({ span, doctor: row.doctor });
                          }}
                        >
                          <span className="min-w-0 text-left w-full">
                            <span className="block truncate font-medium">
                              {span.kind === "booked"
                                ? span.appointment?.booked_by &&
                                  !span.appointment.booked_by.patient_linked
                                  ? `Booked by ${span.appointment.booked_by.name}`
                                  : (span.appointment?.patient_name ?? "Booked")
                                : span.kind === "blocked"
                                  ? (span.reason ?? "Blocked")
                                  : states[span.kind]}
                            </span>
                            <span className="block truncate mt-1 opacity-75 tabular-nums">
                              {clock(span.start)}–{clock(span.end)}
                            </span>
                          </span>
                        </Button>
                      ))}
                      {highlight?.doctor === row.doctor_id && (
                        <div
                          className="absolute inset-y-0 z-20 bg-foreground/10 border-2 border-foreground rounded-sm pointer-events-none"
                          style={{
                            left: pct(highlight.start),
                            width: `${((highlight.end - highlight.start) / (end - start)) * 100}%`,
                          }}
                        >
                          <span className="absolute top-0 left-0 bg-foreground text-background text-xs whitespace-nowrap px-2 py-1 tabular-nums">
                            {clock(highlight.start)}–{clock(highlight.end)}
                          </span>
                        </div>
                      )}
                      {showNow && (
                        <div
                          aria-label="Current time"
                          className="absolute inset-y-0 border-l-2 border-red-500 pointer-events-none z-10"
                          style={{ left: pct(current) }}
                        >
                          <span className="absolute -top-1 -left-[5px] size-2 rounded-full bg-red-500" />
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            {!rows.length && (
              <div className="px-6 py-16 text-center">
                <p className="font-medium">No doctors match these filters</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try another clinic, department or doctor name.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setQuery("");
                    setDepartment("all");
                    setBranch("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
          <footer className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {draft
                ? "Outlined ranges use published free slots. This is a partial timeline; missing holds and closure history are not inferred. Range edits are drafts only."
                : "Thin lines mark published hours. Outlined ranges are free time. Staff can enter exact minutes; booking rechecks every conflict."}
            </span>
            <span>
              Updated{" "}
              {board.data &&
                new Intl.DateTimeFormat("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(board.data.as_of))}{" "}
              · IST
            </span>
          </footer>
        </Card>
      </Resource>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && confirmLeave()) setSelected(null);
        }}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{states[selected.span.kind]}</SheetTitle>
                <SheetDescription>{selected.doctor.name}</SheetDescription>
              </SheetHeader>
              <div className="px-4 space-y-5">
                <Badge
                  variant="outline"
                  className={classes[selected.span.kind]}
                >
                  {states[selected.span.kind]}
                </Badge>
                <div>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {clock(selected.span.start)} – {clock(selected.span.end)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {dateLabel(day)} · IST
                  </p>
                </div>
                <Separator />
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Clinic</dt>
                    <dd className="mt-1 font-medium">
                      {clinic(selected.span.branch_id)}
                    </dd>
                  </div>
                  {selected.span.reason && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Reason</dt>
                      <dd className="mt-1">{selected.span.reason}</dd>
                    </div>
                  )}
                  {selected.span.kind === "available" && (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Available appointments
                      </dt>
                      <dd className="mt-1">
                        {selected.span.count} slots ·{" "}
                        {selected.span.consultation_type === "virtual"
                          ? "Virtual"
                          : "In person"}
                      </dd>
                    </div>
                  )}
                  {selected.span.expires_at && (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Hold expires
                      </dt>
                      <dd className="mt-1">
                        {dateTime(selected.span.expires_at)}
                      </dd>
                    </div>
                  )}
                  {selected.span.appointment && (
                    <>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Patient
                        </dt>
                        <dd className="mt-1 font-medium">
                          {selected.span.appointment.patient_name}
                        </dd>
                      </div>
                      {selected.span.appointment.booked_by && (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Booked by
                          </dt>
                          <dd className="mt-1">
                            {selected.span.appointment.booked_by.name}
                            {selected.span.appointment.booked_by.phone && (
                              <span className="block text-xs text-muted-foreground tabular-nums">
                                {selected.span.appointment.booked_by.phone}
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Status / reference
                        </dt>
                        <dd className="mt-1 capitalize">
                          {selected.span.appointment.status.replaceAll(
                            "_",
                            " ",
                          )}{" "}
                          · {selected.span.appointment.confirmation_code}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  {draft
                    ? "This partial timeline refreshes every minute while visible. Saved administrative notes and exact-time changes await integration."
                    : "Availability refreshes every minute. Booking checks the selected slot again before confirming."}
                </p>
                {selected.span.appointment && (
                  <>
                    {selected.span.appointment.overbooking_reason && (
                      <div className="border rounded-md p-3 text-sm">
                        <p className="font-medium">Overlapping appointment</p>
                        <p className="text-muted-foreground mt-1">
                          {selected.span.appointment.overbooking_reason}
                        </p>
                      </div>
                    )}
                    <AppointmentActions
                      key={selected.span.appointment.id}
                      item={selected.span.appointment}
                      allowed={permissions.data?.allowed ?? {}}
                      onSaved={() => {
                        setSelected(null);
                        refresh();
                      }}
                    />
                    {permissions.can("appointments.overbook") && (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={
                          day < clinicToday() || !selected.doctor.is_active
                        }
                        onClick={() =>
                          selectRange(
                            selected.doctor,
                            selected.span.start,
                            selected.span.end,
                            selected.span,
                            30,
                            true,
                          )
                        }
                      >
                        Add another appointment at this time
                      </Button>
                    )}
                  </>
                )}
                {selected.span.kind === "blocked" &&
                  selected.span.exception_id &&
                  permissions.can("schedule.block") && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Unblock removes this whole block (
                        {dateTime(selected.span.starts_at)}–
                        {dateTime(selected.span.ends_at)}). Unoccupied published
                        slots become available again.
                      </p>
                      <Field label="Reason for unblocking" id="unblock-reason">
                        <Input
                          id="unblock-reason"
                          value={unblockReason}
                          maxLength={240}
                          onChange={(e) => setUnblockReason(e.target.value)}
                        />
                      </Field>
                      <Action
                        disabled={unblockReason.trim().length < 3}
                        run={async () => {
                          await api(
                            `/api/v1/admin/schedule-exceptions/${selected.span.exception_id}`,
                            {
                              method: "DELETE",
                              body: { reason: unblockReason.trim() },
                            },
                          );
                          setUnblockReason("");
                          setSelected(null);
                          refresh();
                        }}
                        success="Time unblocked"
                      >
                        Unblock this time
                      </Action>
                    </div>
                  )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={weeklyPicker} onOpenChange={setWeeklyPicker}>
        <SheetContent style={{ width: "min(100vw, 460px)", maxWidth: "100vw" }}>
          <SheetHeader>
            <SheetTitle>
              {weeklyMode === "virtual"
                ? "Configure teleconsultation hours"
                : "Configure weekly hours"}
            </SheetTitle>
            <SheetDescription>
              Choose a doctor, then select repeat days and split shifts.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 space-y-5">
            <Choice
              label="Doctor"
              value={weeklyDoctor}
              onChange={setWeeklyDoctor}
              options={(doctors.data ?? [])
                .filter((d) => d.is_active)
                .map((d) => [d.id, d.name])}
            />
            <Button
              disabled={!weeklyDoctor}
              onClick={() => {
                const doctor = doctors.data?.find((d) => d.id === weeklyDoctor);
                if (doctor) {
                  setWeeklyPicker(false);
                  setWeekly(doctor);
                }
              }}
            >
              {weeklyMode === "virtual"
                ? "Set teleconsultation hours"
                : "Set weekly hours"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {weeklySelection && catalogue.data && (
        <WeeklyHours
          key={`${weeklySelection.id}:${selectedWeeklyMode}`}
          doctor={weeklySelection}
          initialMode={selectedWeeklyMode}
          onDoctorProfile={onDoctorProfile}
          catalogue={catalogue.data}
          branch={chosenBranch === "all" ? "" : chosenBranch}
          day={day}
          allowed={permissions.data?.allowed ?? {}}
          onClose={() => {
            if (confirmLeave()) {
              setConsumedLink(requestedLink);
              setWeekly(null);
            }
          }}
          // Catalogue refresh unmounts WeeklyHours and discards its unsaved draft.
          // Resolving appointments or saving hours needs only a fresh board.
          onSaved={refreshBoard}
        />
      )}
      {range && catalogue.data && (
        <ScheduleRangeActions
          key={`${range.doctor.id}:${range.day}:${range.start}:${range.end}:${range.branch}:${rangeIntent}`}
          range={range}
          catalogue={catalogue.data}
          allowed={
            rangeIntent
              ? {
                  ...(permissions.data?.allowed ?? {}),
                  "appointments.create":
                    rangeIntent === "book" &&
                    permissions.can("appointments.create"),
                  "schedule.block":
                    rangeIntent === "block" &&
                    permissions.can("schedule.block"),
                  "schedules.manage": false,
                }
              : (permissions.data?.allowed ?? {})
          }
          onClose={() => {
            if (confirmLeave()) setRange(null);
          }}
          onSaved={(nextDay) => {
            if (nextDay) setDay(nextDay);
            refresh();
          }}
        />
      )}
    </>
  );
}
