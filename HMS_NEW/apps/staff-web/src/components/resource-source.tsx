import { createContext } from "react";
import type { Permissions } from "./workspace";

/** A frontend view-model source for the retained original components, not an API compatibility server. */
export type OriginalResourceSource = {
  scope: string;
  permissions: Permissions;
  read: <T>(path: string, signal: AbortSignal) => Promise<T>;
  unavailableWrite: string;
};
export const OriginalResourceContext =
  createContext<OriginalResourceSource | null>(null);
