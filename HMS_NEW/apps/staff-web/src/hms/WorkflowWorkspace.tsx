import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "./hooks";
import { Appointments } from "./Appointments";
import { Waitlist } from "./Waitlist";
import { Queue } from "./Queue";
import { ActivityLogPage } from "./ActivityLog";
import { Overview } from "./Overview";

// Keep the existing routes and workflow components, including their permissions,
// so saved links and handoffs open the relevant tab of the shared workspace.
export function AppointmentWorkspace({ page }: { page: string }) {
  const { go } = useWorkspace();
  return (
    <Tabs value={page} onValueChange={go} className="gap-6">
      <TabsList
        aria-label="Appointment workspace"
        className="w-fit flex-wrap justify-start gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
      >
        {[
          {
            id: "appointments",
            title: "Appointments",
            description: "Book a time & check in",
          },
          {
            id: "waitlist",
            title: "Waitlist",
            description: "Offer an available slot",
          },
          {
            id: "queue",
            title: "Queue",
            description: "Manage patients who arrived",
          },
        ].map((item) => (
          <TabsTrigger key={item.id} value={item.id} variant="workflow">
            {item.title}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={page}>
        {page === "waitlist" ? (
          <Waitlist />
        ) : page === "queue" ? (
          <Queue />
        ) : (
          <Appointments />
        )}
      </TabsContent>
    </Tabs>
  );
}

export function ActivityWorkspace({ page }: { page: string }) {
  const { go, can } = useWorkspace();
  return (
    <Tabs value={page} onValueChange={go} className="gap-6">
      <TabsList
        aria-label="Activity workspace"
        className="w-fit flex-wrap justify-start gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
      >
        <TabsTrigger variant="workflow" value="activity">
          Staff activity
        </TabsTrigger>
        {can("appointments.read") && (
          <TabsTrigger variant="workflow" value="operations">
            System status
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value={page}>
        {page === "operations" ? (
          <Overview page="operations" />
        ) : (
          <ActivityLogPage />
        )}
      </TabsContent>
    </Tabs>
  );
}
