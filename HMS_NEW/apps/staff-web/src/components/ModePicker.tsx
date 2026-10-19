import { useEffect, useState } from "react";
import "./modes.css";

const MODES = [
  { id: "mono", name: "Monochrome" },
  { id: "lagoon", name: "Lagoon" },
  { id: "iris", name: "Iris" },
  { id: "terracotta", name: "Terracotta" },
  { id: "sage", name: "Sage" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const KEY = "staff-color-mode";

function savedMode(): Mode {
  try {
    const value = localStorage.getItem(KEY);
    return MODES.some((m) => m.id === value) ? (value as Mode) : "mono";
  } catch {
    return "mono";
  }
}

// Apply before first paint so a saved mode doesn't flash monochrome.
document.documentElement.dataset.colorMode = savedMode();

export function ModePicker() {
  const [mode, setMode] = useState<Mode>(savedMode);
  useEffect(() => {
    document.documentElement.dataset.colorMode = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* storage unavailable: mode lasts for this tab only */
    }
  }, [mode]);

  return (
    <div role="radiogroup" aria-label="Colour mode" className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          aria-label={m.name}
          title={m.name}
          onClick={() => setMode(m.id)}
          className={`flex items-center gap-1.5 rounded-full p-0.5 transition-colors ${mode === m.id ? "bg-muted pr-2.5" : "hover:bg-muted"}`}
        >
          <span
            data-color-mode={m.id}
            className="mode-swatch size-5 rounded-full ring-1 ring-black/10"
            style={{ background: "conic-gradient(var(--sidebar) 0 50%, var(--primary) 0 80%, var(--chart-2) 0)" }}
          />
          <span className="pr-2 text-sm">{m.name}</span>
        </button>
      ))}
    </div>
  );
}
