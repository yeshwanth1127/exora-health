import { useEffect } from "react";
import { LeaveState } from "./leave-state";
export const leaveState = new LeaveState();
export function requestLeave(action: () => void) {
  leaveState.request(action);
}
export function hasUnsavedChanges() {
  return leaveState.isDirty();
}
export function useUnsaved(dirty: boolean, options?: { pending?: boolean }) {
  const pending = options?.pending ?? false;
  useEffect(() => {
    if (!dirty && !pending) return;
    const unregister = leaveState.register(pending);
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty, pending]);
}
