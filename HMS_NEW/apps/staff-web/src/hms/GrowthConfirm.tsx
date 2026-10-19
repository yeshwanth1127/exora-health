import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Button } from "@/components/arc/button/button";
import { confirmationCommit } from "./growth-confirmation";

export function GrowthConfirm({
  open,
  onDismiss,
  title,
  description,
  confirmLabel,
  onConfirm,
  blockedReason,
  destructive = true,
}: {
  open: boolean;
  onDismiss: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  blockedReason?: string;
  destructive?: boolean;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const returnPanel = useRef<HTMLElement | null>(null);
  const commit = useRef(confirmationCommit());
  const [error, setError] = useState({ open, text: "" });
  if (error.open !== open) setError({ open, text: "" });
  useEffect(() => {
    if (open) {
      commit.current = confirmationCommit();
    }
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent
        title={title}
        description={description}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          returnPanel.current =
            opener.current?.closest<HTMLElement>('[role="tabpanel"]') ?? null;
          cancel.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
          else if (returnPanel.current?.isConnected)
            returnPanel.current.focus();
        }}
      >
        {blockedReason && (
          <p role="alert" className="mb-4 text-sm">
            {blockedReason}
          </p>
        )}
        {error.text && (
          <p role="alert" className="mb-4 text-sm">
            {error.text}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            ref={cancel}
            type="button"
            variant="secondary"
            onClick={onDismiss}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            disabled={!!blockedReason}
            onClick={() => {
              try {
                commit.current(!open || !!blockedReason, () => {
                  onConfirm();
                  onDismiss();
                });
              } catch {
                setError({
                  open,
                  text: "This change could not be completed. Review it before trying again.",
                });
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
