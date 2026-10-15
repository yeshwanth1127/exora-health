import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntentKeys, request } from "./client";

export function WhatsAppConsent({
  contactPointId,
  saved,
}: {
  contactPointId: string;
  saved: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [evidence, setEvidence] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const [keys] = useState(() => new IntentKeys());
  const save = async (action: "opt_in" | "stop") => {
    const path = `/v1/contact-points/${contactPointId}/consents`,
      body = {
        purpose: "care",
        action,
        source: "staff",
        evidence: evidence.trim(),
        explicitOptIn: action === "opt_in",
      };
    setBusy(true);
    try {
      await request(path, {
        method: "POST",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      await saved();
      setOpen(false);
      setEvidence("");
      setConfirmed(false);
      toast.success(
        action === "opt_in"
          ? "Messaging permission recorded"
          : "Messaging stopped",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Permission could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Messaging permission
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Messaging permission</DialogTitle>
            <DialogDescription>
              Record what this person explicitly agreed to. Receiving a message
              alone does not grant permission for care messages or promotions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="wa-consent-evidence">
              How and when permission was given or withdrawn
            </Label>
            <Textarea
              id="wa-consent-evidence"
              maxLength={500}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Record the person's explicit words or the consent reference."
              disabled={busy}
            />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmed}
                disabled={busy}
                onCheckedChange={(v) => setConfirmed(!!v)}
              />
              <span>
                This person explicitly agreed to care messages from this clinic.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy || evidence.trim().length < 3}
              onClick={() => void save("stop")}
            >
              Record withdrawal
            </Button>
            <Button
              disabled={busy || !confirmed || evidence.trim().length < 3}
              onClick={() => void save("opt_in")}
            >
              {busy ? "Saving…" : "Record permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
