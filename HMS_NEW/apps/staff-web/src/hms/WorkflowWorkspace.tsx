import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { useWorkspace } from "./hooks";
import { Appointments } from "./Appointments";
import { Waitlist } from "./Waitlist";
import { Queue } from "./Queue";
import { ActivityLogPage } from "./ActivityLog";
import { Overview } from "./Overview";

// Each route keeps its own panel identity so Arc can animate the outgoing/incoming
// content. Routing remains controlled by the workspace's existing leave guard.
export function AppointmentWorkspace({ page }: { page: string }) {
  const { go } = useWorkspace();
  return (
    <Tabs value={page} onValueChange={go} className="arc-workflow-root">
      <div className="arc-demo-scope">
        <TabsList aria-label="Appointment workspace">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="appointments" className="arc-workflow-panel"><Appointments /></TabsContent>
      <TabsContent value="waitlist" className="arc-workflow-panel"><Waitlist /></TabsContent>
      <TabsContent value="queue" className="arc-workflow-panel"><Queue /></TabsContent>
    </Tabs>
  );
}

export function ActivityWorkspace({ page }: { page: string }) {
  const { go, can } = useWorkspace();
  return (
    <Tabs value={page} onValueChange={go} className="arc-workflow-root">
      <div className="arc-demo-scope">
        <TabsList aria-label="Activity workspace">
          <TabsTrigger value="activity">Staff activity</TabsTrigger>
          {can("appointments.read") && <TabsTrigger value="operations">System status</TabsTrigger>}
        </TabsList>
      </div>
      <TabsContent value="activity" className="arc-workflow-panel"><ActivityLogPage /></TabsContent>
      {can("appointments.read") && <TabsContent value="operations" className="arc-workflow-panel"><Overview page="operations" /></TabsContent>}
    </Tabs>
  );
}
