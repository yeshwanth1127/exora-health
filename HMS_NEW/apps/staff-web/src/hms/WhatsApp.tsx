import { useMemo, useState } from "react";
import { OriginalResourceContext } from "@/components/resource-source";
import { WhatsAppModule } from "@/modules/whatsapp";
import { useWorkspace } from "./hooks";
import { whatsappSource } from "./whatsapp-source";
import { can } from "./model";
export function WhatsApp() {
  const { me, facility, go, practitioners } = useWorkspace();
  const [page, setPage] = useState("overview");
  const source = useMemo(
    () => whatsappSource(me, facility, practitioners),
    [me, facility, practitioners],
  );
  const user = {
    id: me.staffId,
    username: me.staffId,
    name: me.displayName,
    role: can(me, "comms.manage", facility.facilityId) || can(me, "facility.manage", facility.facilityId) ? "admin" : "staff",
    active: true,
  };
  return (
    <OriginalResourceContext.Provider value={source}>
      <WhatsAppModule
        key={`${me.tenantId}:${facility.facilityId}:${me.staffId}`}
        user={user}
        page={page}
        onNavigate={setPage}
        onAppointments={() => go("appointments")}
        localNotifications
      />
    </OriginalResourceContext.Provider>
  );
}
