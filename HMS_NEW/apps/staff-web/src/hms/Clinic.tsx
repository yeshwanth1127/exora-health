import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { today, time } from "./model";
import { Choice, Empty, Hint, LoadingState, Status } from "./ui";
import type { Slot } from "./types";

export function Clinic({ page }: { page: string }) {
  const { facility, practitioners, go } = useWorkspace();
  const [date, setDate] = useState(today(facility.timezone)),
    [staffId, setStaffId] = useState(practitioners[0]?.staffId ?? "");
  const selected = staffId || practitioners[0]?.staffId || "";
  const result = useQuery<{ items: Slot[] }>(
    page === "schedules" && selected
      ? `/v1/practitioners/${selected}/slots?${query({ facilityId: facility.facilityId, from: date, to: date, includeUnavailable: true })}`
      : null,
    15000,
  );
  return (
    <>
      <PageTitle
        title={page === "doctors" ? "Doctors" : "Schedules"}
        description={
          page === "doctors"
            ? "Practitioners affiliated with your selected clinic."
            : "Published bookable slots for a doctor and day."
        }
      />
      {page === "doctors" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Calendar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practitioners.map((p) => (
                <TableRow key={p.staffId}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.department}</TableCell>
                  <TableCell>{p.specialtyName ?? "Not recorded"}</TableCell>
                  <TableCell>
                    {p.calendarId ? "Available" : "Not configured"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {practitioners.length === 0 && (
            <Empty>No practitioners found for this clinic.</Empty>
          )}
          <CardContent className="pt-4 text-xs text-muted-foreground">
            Profile, fee and affiliation editing are not available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <div className="w-60">
              <Choice
                label="Schedule doctor"
                value={selected}
                onChange={setStaffId}
                options={practitioners
                  .filter((p) => p.calendarId)
                  .map((p) => ({ value: p.staffId, label: p.name }))}
              />
            </div>
            <Input
              type="date"
              aria-label="Schedule date"
              className="w-44"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button variant="outline" onClick={() => go("appointments")}>
              <CalendarDays />
              Book appointment
            </Button>
          </div>
          <Hint>
            This shows remaining published slots. Past slots, individual holds,
            full-day closure reasons and the complete timeline need the
            calendar-board API. Weekly editing, blocks and exact-time booking
            are deferred.
          </Hint>
          <LoadingState {...result}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-6">
                  <Clock3 className="size-4" />
                  <span className="font-medium">
                    {practitioners.find((p) => p.staffId === selected)?.name} ·{" "}
                    {date}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {result.data?.items.map((s) => (
                    <div
                      key={s.slotStart}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <p className="text-sm font-medium">
                        {time(s.slotStart, facility.timezone)} –{" "}
                        {time(s.slotEnd, facility.timezone)}
                      </p>
                      <Status value={s.status} />
                      <p className="text-xs text-muted-foreground">
                        {s.visitMode === "virtual"
                          ? "Video consultation"
                          : "In person"}
                      </p>
                    </div>
                  ))}
                </div>
                {result.data?.items.length === 0 && (
                  <Empty>No remaining published slots on this day.</Empty>
                )}
              </CardContent>
            </Card>
          </LoadingState>
        </div>
      )}
    </>
  );
}
