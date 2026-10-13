import { ScheduleTimeline } from "./schedule-timeline";
import { clinicToday } from "./clinic-types";
import { WaitlistDesk } from "./BookingOperations";
import { NurseDesk } from "./NurseDesk";
import { useState } from "react";
import { api, type Catalogue, type StaffUser } from "@/lib/api";
import {
  Action,
  Field,
  PageTitle,
  Resource,
  StateBadge,
  usePermissions,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

type Doctor = {
  id: string;
  name: string;
  title: string;
  consultation_fee: number;
  is_active: boolean;
  accepts_virtual: boolean;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};
export function ClinicModule({ module }: { module: string; user: StaffUser }) {
  return module === "appointments" ? (
    <Appointments />
  ) : module === "doctors" ? (
    <Doctors />
  ) : (
    <Schedules />
  );
}
function Appointments() {
  const doctors = useResource<Doctor[]>("/api/v1/admin/doctors");
  const catalogue = useResource<Catalogue>("/api/v1/admin/catalogue");
  return (
    <Resource
      loading={doctors.loading || catalogue.loading}
      error={doctors.error || catalogue.error}
      refresh={() => {
        doctors.refresh();
        catalogue.refresh();
      }}
    >
      <>
        <NurseDesk
          api={api}
          doctors={doctors.data ?? []}
          branches={catalogue.data?.branches ?? []}
        />
        <WaitlistDesk />
      </>
    </Resource>
  );
}
function Doctors() {
  const permissions = usePermissions(),
    r = useResource<Doctor[]>("/api/v1/admin/doctors"),
    [edit, setEdit] = useState<Doctor | null>(null);
  return (
    <>
      <PageTitle
        title="Doctors"
        description="Keep booking fees and doctor availability accurate across all clinic channels."
      />
      <Resource {...r}>
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialties & clinics</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.name}
                    <p className="text-xs text-muted-foreground font-normal mt-1">
                      {d.title}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {d.departments.map((d) => d.name).join(", ")}
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.branches.map((b) => b.name).join(", ")}
                    </p>
                  </TableCell>
                  <TableCell>
                    ₹{d.consultation_fee.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <StateBadge value={d.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    {permissions.can("doctors.manage") ? (
                      <Button variant="outline" onClick={() => setEdit(d)}>
                        Edit doctor
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Administrator only
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Resource>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit doctor</DialogTitle>
            <DialogDescription>{edit?.name}</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-5">
              <Field
                label="Consultation fee (₹)"
                id="doctor-fee"
                error={
                  !Number.isInteger(edit.consultation_fee) ||
                  edit.consultation_fee < 0 ||
                  edit.consultation_fee > 100000
                    ? "Enter a whole consultation fee from ₹0 to ₹1,00,000."
                    : undefined
                }
                hint={
                  permissions.admin
                    ? "Changes apply to future bookings; existing fee snapshots are preserved."
                    : "Only a clinic administrator can change fees."
                }
              >
                <Input
                  id="doctor-fee"
                  type="number"
                  disabled={!permissions.admin}
                  min={0}
                  max={100000}
                  value={edit.consultation_fee}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      consultation_fee: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <div className="flex justify-between">
                <Label htmlFor="doctor-active" className="text-sm">
                  Active in booking directory
                </Label>
                <Switch
                  id="doctor-active"
                  checked={edit.is_active}
                  onCheckedChange={(v) => setEdit({ ...edit, is_active: v })}
                />
              </div>
              <div className="flex justify-between">
                <Label htmlFor="doctor-virtual" className="text-sm">
                  Accepts virtual consultations
                </Label>
                <Switch
                  id="doctor-virtual"
                  checked={edit.accepts_virtual}
                  onCheckedChange={(v) =>
                    setEdit({ ...edit, accepts_virtual: v })
                  }
                />
              </div>
              <Action
                disabled={
                  !Number.isInteger(edit.consultation_fee) ||
                  edit.consultation_fee < 0 ||
                  edit.consultation_fee > 100000
                }
                run={async () => {
                  await api(`/api/v1/admin/doctors/${edit.id}`, {
                    method: "PATCH",
                    body: {
                      is_active: edit.is_active,
                      accepts_virtual: edit.accepts_virtual,
                      ...(permissions.admin
                        ? { consultation_fee: edit.consultation_fee }
                        : {}),
                    },
                  });
                  setEdit(null);
                  r.refresh();
                }}
                success="Doctor updated"
              >
                Save doctor
              </Action>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function Schedules() {
  const [day, setDay] = useState(clinicToday);
  return (
    <>
      <PageTitle
        title="Schedules"
        description="Drag across a doctor's day to open time, block time or book a visit."
      />
      <ScheduleTimeline day={day} setDay={setDay} />
    </>
  );
}
