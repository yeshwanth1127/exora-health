import { requestLeave } from "./leave";
import { useMemo, useState } from "react";
import { ChannelOnboarding } from "./ChannelOnboarding";
import { Button } from "@/components/ui/button";
import { VoiceModule } from "@/modules/voice";
import { OriginalResourceContext } from "@/components/resource-source";
import { voiceSource } from "./voice-source";
import { useWorkspace } from "./hooks";
import { requestBytes } from "./client";
export function Voice() {
  const [setup, setSetup] = useState(false);
  const { me, facility } = useWorkspace();
  const source = useMemo(() => voiceSource(me, facility), [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <div className="mb-6 flex gap-2">
        <Button
          variant={setup ? "default" : "outline"}
          onClick={() => requestLeave(() => setSetup(true))}
        >
          Call setup
        </Button>
        <Button
          variant={!setup ? "default" : "outline"}
          onClick={() => requestLeave(() => setSetup(false))}
        >
          Call history
        </Button>
      </div>
      {setup ? (
        <ChannelOnboarding channel="voice" />
      ) : (
        <VoiceModule
          recordingLoader={(id) =>
            requestBytes(`/v1/voice-calls/${id}/recording`)
          }
        />
      )}
    </OriginalResourceContext.Provider>
  );
}
