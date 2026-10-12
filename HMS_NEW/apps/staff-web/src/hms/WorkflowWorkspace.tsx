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
        className="w-full gap-3 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
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
          <TabsTrigger
            key={item.id}
            value={item.id}
            className="h-auto min-h-20 flex-col items-start justify-center rounded-lg border border-border px-5 py-3 text-left text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background"
          >
            <span className="text-base font-semibold">{item.title}</span>
            <span className="text-xs font-normal opacity-75">
              {item.description}
            </span>
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
        className="w-full gap-3 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
      >
        <TabsTrigger
          className="h-auto min-h-16 flex-col items-start justify-center rounded-lg border border-border px-5 py-3 text-left text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background"
          value="activity"
        >
          <span className="font-semibold">Staff activity</span>
          <span className="text-xs font-normal opacity-75">
            Changes, chart access & audit history
          </span>
        </TabsTrigger>
        {can("appointments.read") && (
          <TabsTrigger
            className="h-auto min-h-16 flex-col items-start justify-center rounded-lg border border-border px-5 py-3 text-left text-foreground data-active:border-foreground data-active:bg-foreground data-active:text-background"
            value="operations"
          >
            <span className="font-semibold">System status</span>
            <span className="text-xs font-normal opacity-75">
              Background events & service readiness
            </span>
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
