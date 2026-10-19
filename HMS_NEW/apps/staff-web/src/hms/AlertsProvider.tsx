import type { ReactNode } from "react";
import { AlertsContext, useAlertsSource } from "./use-alerts";

/** Shares one set of alert reads between the header bell and the Alerts page. */
export function AlertsProvider({ children }: { children: ReactNode }) {
  return <AlertsContext.Provider value={useAlertsSource()}>{children}</AlertsContext.Provider>;
}
