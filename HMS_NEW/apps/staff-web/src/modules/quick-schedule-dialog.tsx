import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Stethoscope, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Choice, Field, useApi } from "@/components/workspace";
import { request } from "@/hms/client";
import type { Doctor } from "./clinic-types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const tomorrow = () => {
  const date = new Date(
    `${new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())}T12:00:00Z`,
  );
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

type Service = {
  healthcareServiceId: string;
  name: string;
  serviceMode: "in_person" | "virtual" | "both";
};
type Preview = { affected_appointments: unknown[]; can_save: boolean };

export function QuickScheduleDialog({
  open,
  onOpenChange,
  doctors,
  facilityId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  facilityId: string;
  onSaved: () => void;
}) {
  const api = useApi();
  const activeDoctors = useMemo(
    () =>
      doctors.filter(
        (doctor) =>
          doctor.is_active && doctor.branches.some((b) => b.id === facilityId),
      ),
    [doctors, facilityId],
  );
  const [doctorId, setDoctorId] = useState("");
  const [mode, setMode] = useState<"in_person" | "virtual">("in_person");
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [minutes, setMinutes] = useState("30");
  const [from, setFrom] = useState(tomorrow);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const doctor = activeDoctors.find((item) => item.id === doctorId);
  const compatibleServices = services.filter(
    (service) => service.serviceMode === mode || service.serviceMode === "both",
  );

  useEffect(() => {
    if (!open) return;
    setDoctorId((current) => current || activeDoctors[0]?.id || "");
    void request<{ services: Service[] }>(
      `/v1/facilities/${facilityId}/directory`,
    )
      .then((value) => setServices(value.services))
      .catch((reason: Error) => setError(reason.message));
  }, [open, activeDoctors, facilityId]);

  useEffect(() => {
    if (
      !compatibleServices.some(
        (service) => service.healthcareServiceId === serviceId,
      )
    )
      setServiceId(compatibleServices[0]?.healthcareServiceId || "");
  }, [compatibleServices, serviceId]);

  const valid =
    !!doctor &&
    !!serviceId &&
    days.length > 0 &&
    start < end &&
    from >= tomorrow() &&
    Number(minutes) >= 5;
  const body = {
    doctor_id: doctorId,
    branch_id: facilityId,
    consultation_type: mode,
    effective_from: from,
    effective_until: null,
    slot_minutes: Number(minutes),
    healthcare_service_id: serviceId,
    groups: [{ days, windows: [{ start, end }] }],
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const preview = await api<Preview>(
        "/api/v1/admin/schedule-timeline/weekly/preview",
        { method: "POST", body },
      );
      if (preview.affected_appointments.length) {
        setError(
          `${preview.affected_appointments.length} existing appointment${preview.affected_appointments.length === 1 ? " is" : "s are"} outside these hours. Resolve them in Advanced scheduling before replacing the schedule.`,
        );
        return;
      }
      if (!preview.can_save) {
        setError("These hours cannot be saved. Check the doctor and service.");
        return;
      }
      await api("/api/v1/admin/schedule-timeline/weekly", {
        method: "PUT",
        body,
      });
      toast.success("Doctor hours saved");
      onSaved();
      onOpenChange(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save these hours.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Set doctor hours</DialogTitle>
          <DialogDescription>
            Pick the basics. We’ll check conflicts and publish the weekly
            schedule in one step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Field label="Doctor" id="quick-schedule-doctor">
            <Choice
              label="Doctor"
              value={doctorId}
              onChange={setDoctorId}
              options={activeDoctors.map((item) => [item.id, item.name])}
            />
          </Field>

          <Field label="Appointment type" id="quick-schedule-mode">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mode === "in_person" ? "default" : "outline"}
                onClick={() => setMode("in_person")}
              >
                <Stethoscope /> At the clinic
              </Button>
              <Button
                variant={mode === "virtual" ? "default" : "outline"}
                disabled={!doctor?.accepts_virtual}
                onClick={() => setMode("virtual")}
              >
                <Video /> Video consultation
              </Button>
            </div>
          </Field>

          {compatibleServices.length > 1 && (
            <Field label="Service" id="quick-schedule-service">
              <Choice
                label="Service"
                value={serviceId}
                onChange={setServiceId}
                options={compatibleServices.map((item) => [
                  item.healthcareServiceId,
                  item.name,
                ])}
              />
            </Field>
          )}

          <Field label="Working days" id="quick-schedule-days">
            <div
              className="grid grid-cols-7 gap-2"
              role="group"
              aria-label="Working days"
            >
              {DAYS.map((label, index) => (
                <Button
                  key={label}
                  size="sm"
                  variant={days.includes(index) ? "default" : "outline"}
                  aria-pressed={days.includes(index)}
                  onClick={() =>
                    setDays((current) =>
                      current.includes(index)
                        ? current.filter((day) => day !== index)
                        : [...current, index].sort(),
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Starts at" id="quick-schedule-start">
              <Input
                id="quick-schedule-start"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Ends at" id="quick-schedule-end">
              <Input
                id="quick-schedule-end"
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
            <Field label="Appointment length" id="quick-schedule-length">
              <Choice
                label="Appointment length"
                value={minutes}
                onChange={setMinutes}
                options={[
                  ["15", "15 minutes"],
                  ["20", "20 minutes"],
                  ["30", "30 minutes"],
                  ["45", "45 minutes"],
                  ["60", "60 minutes"],
                ]}
              />
            </Field>
          </div>

          <Field
            label="Start this schedule"
            id="quick-schedule-from"
            hint="Recurring hours can start tomorrow or later."
          >
            <Input
              id="quick-schedule-from"
              type="date"
              min={tomorrow()}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>

          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex gap-3">
              <CalendarCheck2 className="mt-0.5 size-5" />
              <div>
                <p className="font-medium">Ready to repeat every week</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {doctor?.name || "Choose a doctor"} ·{" "}
                  {days.map((day) => DAYS[day]).join(", ") || "Choose days"} ·{" "}
                  {start}–{end} · {minutes}-minute appointments · from {from}.
                </p>
              </div>
            </div>
          </div>

          {!compatibleServices.length && (
            <Alert>
              <AlertDescription>
                Add an active {mode === "virtual" ? "video" : "clinic"} service
                in Hospital catalogue before publishing hours.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="-mx-6 -mb-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => void save()}>
            <CalendarCheck2 /> {busy ? "Checking and saving…" : "Save hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
