import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
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
      <DialogContent title={blocked ? "Confirm the original request first" : "Leave this unfinished task?"}
        description={blocked ? "A request is still being saved or has an unknown outcome. Stay on this task and recover the original request before navigating away."
          : "Your unsaved changes will be discarded. No draft is saved when you leave."}>
        <div className="flex justify-end gap-2">

          <Button variant="outline" onClick={leaveState.stay}>
            Keep editing
          </Button>
          {!blocked && (
            <Button variant="destructive" onClick={leaveState.discard}>
              Discard and leave
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
