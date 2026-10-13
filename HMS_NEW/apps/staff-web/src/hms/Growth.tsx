import { useMemo, useState } from "react";
import { GrowthModule } from "@/modules/growth/GrowthModule";
import { growthSource } from "./growth-source";
import { useWorkspace } from "./hooks";
import { can } from "./model";
export function Growth({
  module,
}: {
  module: "google_business" | "growth_analytics";
}) {
  const { me, facility } = useWorkspace();
  const [page, setPage] = useState(
    module === "google_business" ? "links" : "overview",
  );
  const api = useMemo(() => growthSource(me, facility), [me, facility]);
  return (
    <GrowthModule
      key={`${facility.facilityId}:${module}`}
      api={api}
      initialClinicId={facility.facilityId}
      user={{
        id: me.staffId,
        username: me.staffId,
        name: me.displayName,
        role: "growth_manager",
        active: true,
      }}
      page={page}
      onNavigate={setPage}
      module={module}
      canManage={can(me, "growth.manage", facility.facilityId)}
    />
  );
}
