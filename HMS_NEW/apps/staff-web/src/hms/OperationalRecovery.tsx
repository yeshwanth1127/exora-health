import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MutationIntent } from "./operational-intent";
import type { RecoverableCommand } from "./operational-command";
export function RecoveryNotice({
  command,
  verify,
  onRecovered,
}: {
  command: RecoverableCommand;
  verify?: (intent: MutationIntent) => Promise<boolean>;
  onRecovered?: () => void;
}) {
  const [error, setError] = useState("");
  if (!command.unknown) return null;
  return (
    <Alert className="my-3" role="alert">
      <AlertTitle>We couldn’t confirm this change</AlertTitle>
      <AlertDescription>
        <p>
          The original request is kept in this open workspace. Other changes are
          paused until its outcome is confirmed.
        </p>
        {command.intent?.keyed ? (
          <Button
            className="mt-3"
            variant="outline"
            disabled={command.busy}
            onClick={async () => {
              try {
                setError("");
                await command.recover();
                onRecovered?.();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Recovery failed.");
              }
            }}
          >
            Recover original request
          </Button>
        ) : verify ? (
          <Button
            className="mt-3"
            variant="outline"
            disabled={command.busy}
            onClick={async () => {
              try {
                setError("");
                if (await command.check(verify)) onRecovered?.();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not check the record.",
                );
              }
            }}
          >
            Check saved state
          </Button>
        ) : (
          <p className="mt-2">
            This operation has no safe replay or outcome lookup here. Ask an
            administrator to check the original record; do not repeat it.
          </p>
        )}
        {(error || command.error) && (
          <p className="mt-2 text-destructive">{error || command.error}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
