import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { CommandPalette, type CommandItem } from "./arc/command-palette/command-palette";

export function WorkspaceCommands({ items, onNavigate }: {
  items: CommandItem[];
  onNavigate: (destination: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k" || event.defaultPrevented) return;
      if (!open && document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [open]);
  return <Dialog.Root open={open} onOpenChange={(next, details) => {
    // Arc consumes Escape in its search field: clear the query first, then close.
    // Base UI handles dismissal from other focus targets and outside clicks.
    if (details.reason === "escape-key" && details.event.target instanceof HTMLInputElement) {
      details.cancel();
      return;
    }
    setOpen(next);
  }}>
    <div className="arc-demo-scope">
      <button ref={trigger} type="button" className="arc-command-trigger" aria-label="Search workspace commands" aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Meta+K Control+K" onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" /> Search <kbd>⌘ K</kbd>
      </button>
    </div>
    <Dialog.Portal>
      <Dialog.Backdrop className="arc-command-backdrop" />
      <Dialog.Popup className="arc-demo-scope arc-command-popup" initialFocus={true} finalFocus={trigger} aria-describedby={undefined}>
        <Dialog.Title className="sr-only">Workspace commands</Dialog.Title>
        <CommandPalette items={items} label="Workspace commands" placeholder="Search pages and actions…" autoFocus onClose={() => setOpen(false)} onSelect={(item) => {
          // The existing router decides whether to proceed or show the unsaved-change dialog.
          setOpen(false);
          onNavigate(item.id);
        }} />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
