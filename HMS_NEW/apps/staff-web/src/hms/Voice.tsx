import { useMemo } from "react";
import { VoiceModule } from "@/modules/voice";
import { OriginalResourceContext } from "@/components/resource-source";
import { voiceSource } from "./voice-source";
import { useWorkspace } from "./hooks";
import { requestBytes } from "./client";
export function Voice() {
  const { me, facility } = useWorkspace();
  const source = useMemo(() => voiceSource(me, facility), [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <VoiceModule
        recordingLoader={(id) =>
          requestBytes(`/v1/voice-calls/${id}/recording`)
        }
      />
    </OriginalResourceContext.Provider>
  );
}
