import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, PageTitle } from "@/components/workspace";
import { useWorkspace } from "./hooks";
import { Hint, Empty, Status } from "./ui";
import { confirmLeave, useUnsaved } from "./leave";
import type { Practitioner } from "./types";

export function Doctors() {
  const { facility, practitioners } = useWorkspace();
  const [selected, setSelected] = useState<Practitioner | null>(null);
  return (
    <>
      <PageTitle
        title="Doctors"
        description="Specialties, clinics and the original booking-profile editor."
      />
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Specialties & clinics</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Calendar</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {practitioners.map((p) => (
              <TableRow key={p.staffId}>
                <TableCell className="font-medium">
                  {p.name}
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    {p.specialtyName ?? "Specialty not provided"}
                  </p>
                </TableCell>
                <TableCell>
                  {p.department}
                  <p className="text-xs text-muted-foreground mt-1">
                    {facility.name}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Not provided
                </TableCell>
                <TableCell>
                  <Status value="active" />
                </TableCell>
                <TableCell>
                  {p.calendarId ? "Available" : "Not configured"}
                </TableCell>
                <TableCell>
                  <Button variant="outline" onClick={() => setSelected(p)}>
                    Doctor details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!practitioners.length && (
          <Empty>No practitioners found for this clinic.</Empty>
        )}
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        The current directory returns active practitioners only. Fees and full
        profile information require the profile/pricing API.
      </p>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && confirmLeave()) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Doctor booking profile</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          {selected && (
            <ProfileDraft key={selected.staffId} practitioner={selected} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function ProfileDraft({ practitioner }: { practitioner: Practitioner }) {
  const [active, setActive] = useState(true),
    [virtual, setVirtual] = useState(practitioner.acceptsVirtual);
  useUnsaved(!active || virtual !== practitioner.acceptsVirtual);
  return (
    <div className="space-y-5">
      <Hint>
        Original editor retained as a local draft. Changes cannot be saved until
        backend profile support is connected.
      </Hint>
      <Field
        label="Consultation fee (₹)"
        id="doctor-fee"
        hint="Fees come from the hospital price list and are changed by an administrator there. Unknown is not a zero fee."
      >
        <Input
          id="doctor-fee"
          readOnly
          value=""
          placeholder="Price list read not available yet"
        />
      </Field>
      <div className="flex justify-between gap-4">
        <Label htmlFor="doctor-active">Active in booking directory</Label>
        <Switch
          id="doctor-active"
          checked={active}
          onCheckedChange={setActive}
        />
      </div>
      <div className="flex justify-between gap-4">
        <Label htmlFor="doctor-virtual">
          Accepts virtual consultations
          {virtual === null && (
            <span className="text-muted-foreground"> · Not provided</span>
          )}
        </Label>
        <Switch
          id="doctor-virtual"
          checked={virtual === true}
          disabled={virtual === null}
          onCheckedChange={setVirtual}
        />
      </div>
      <Button
        disabled
        className="w-full"
        title="The backend profile/pricing update contract is not connected."
      >
        Save doctor changes · awaiting integration
      </Button>
    </div>
  );
}
