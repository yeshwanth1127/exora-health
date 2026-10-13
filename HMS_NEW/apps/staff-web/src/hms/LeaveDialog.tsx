import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leaveState } from "./leave";
export function LeaveDialog() {
  const open = useSyncExternalStore(leaveState.subscribe, leaveState.isPending);
  const blocked = useSyncExternalStore(
    leaveState.subscribe,
    leaveState.isBlocked,
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) leaveState.stay();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {blocked
              ? "Confirm the original request first"
              : "Leave this unfinished task?"}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? "A request is still being saved or has an unknown outcome. Stay on this task and recover the original request before navigating away."
              : "Your unsaved changes will be discarded. No draft is saved when you leave."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={leaveState.stay}>
            Keep editing
          </Button>
          {!blocked && (
            <Button variant="destructive" onClick={leaveState.discard}>
              Discard and leave
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
