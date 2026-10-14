import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { useCommand } from "./hooks";

/** Recovery returns the original actor-bound receipt rather than guessing from today's record. */
export function CommandReceiptRecovery({ command, onConfirmed }: {
  command: ReturnType<typeof useCommand>;
  onConfirmed?: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  if (!command.unknown && !confirmed) return null;
  return <Alert className="my-3"><AlertTitle>{confirmed ? "Original request confirmed" : "We couldn’t confirm this change"}</AlertTitle>
    <AlertDescription>
      {confirmed ? <p>Close and reopen this record to see its latest state.</p> : <>
        <p>Other changes are paused. Recover the original request to confirm its saved result.</p>
        {command.canReplay && <Button type="button" variant="outline" className="mt-3" disabled={command.busy} onClick={async () => {
          const result = await command.replay();
          if (result !== undefined) { setConfirmed(true); onConfirmed?.(); }
        }}>Recover original request</Button>}
      </>}
    </AlertDescription></Alert>;
}
