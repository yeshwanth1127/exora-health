import { useEffect } from "react";
export function confirmLeave() {
  return window.dispatchEvent(
    new Event("hms-before-navigation", { cancelable: true }),
  );
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: Event) => {
      if (!window.confirm("Discard the unsaved changes?"))
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("hms-before-navigation", leave);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("hms-before-navigation", leave);
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty]);
}
