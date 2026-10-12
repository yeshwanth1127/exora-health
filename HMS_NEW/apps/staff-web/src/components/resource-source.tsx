import { createContext } from "react";
import type { Permissions } from "./workspace";

/** A frontend view-model source for the retained original components, not an API compatibility server. */
export type OriginalResourceSource = {
  scope: string;
  permissions: Permissions;
  read: <T>(path: string, signal: AbortSignal) => Promise<T>;
  /** Present when this source can save; without it the original editors are drafts. */
  write?: <T>(
    path: string,
    options?: { method?: string; body?: unknown },
  ) => Promise<T>;
  unavailableWrite: string;
  /** Authenticated private media, resolved to a revocable browser blob by useAssetUrl. */
  asset?: (id: string, signal: AbortSignal) => Promise<Blob>;
};
/** True when original editors run without a saving source (local drafts only). */
export const isDraft = (source: OriginalResourceSource | null) =>
  !!source && !source.write;
export const OriginalResourceContext =
  createContext<OriginalResourceSource | null>(null);
