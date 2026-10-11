// Mounts the original Hospital catalogue (read-only): the clinics this user can access, and the
// selected clinic's departments from GET /v1/facilities/:id/directory with its doctors counted.
import { useMemo } from "react";
import { OperationsModule } from "@/modules/operations";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request } from "./client";
import { useWorkspace } from "./hooks";
import { permittedFacilities } from "./model";
import type { Facility } from "./types";

type Directory = { departments: { departmentId: string; name: string }[] };

export function Catalogue() {
  const { me, facility, practitioners } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(() => {
    const directory = (signal: AbortSignal) =>
      request<Directory>(`/v1/facilities/${facility.facilityId}/directory`, {
        signal,
      });
    return {
      scope: `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
      permissions: { role: me.staffType, allowed: {}, staff: [] },
      unavailableWrite: "Nothing on this page saves.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        if (path === "/api/v1/admin/catalogue") {
          const [facilities, dir] = await Promise.all([
            request<{ items: Facility[] }>("/v1/facilities", { signal }),
            directory(signal),
          ]);
          return {
            // The API lists active clinics only.
            branches: permittedFacilities(me, facilities.items).map((f) => ({
              id: f.facilityId,
              name: f.name,
              area: f.city ?? "",
              is_active: true,
              is_virtual: f.facilityType === "virtual",
              address: "",
              directions_url: "",
              arrival_instructions: "",
            })),
            departments: dir.departments.map((d) => ({
              id: d.departmentId,
              name: d.name,
              slug: "",
              is_active: true,
            })),
          } as T;
        }
        if (path === "/api/v1/admin/doctors") {
          // Affiliations carry the department name, so doctors are matched to this clinic's departments by name.
          const { departments } = await directory(signal);
          return practitioners.map((p) => ({
            id: p.staffId,
            name: p.name,
            departments: departments
              .filter((d) => d.name === p.department)
              .map((d) => ({ id: d.departmentId })),
          })) as T;
        }
        throw new Error("Not available on this page.");
      },
    };
  }, [me, facility, practitioners]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <OperationsModule page="catalogue" />
    </OriginalResourceContext.Provider>
  );
}
