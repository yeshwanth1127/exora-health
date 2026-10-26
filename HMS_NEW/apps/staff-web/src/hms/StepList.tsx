import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StepDot } from "./whatsapp-ui";

/** `done` overrides the order-based state when a later step is already saved. */
export type GuideStep = { id: string; title: string; hint: string; summary?: string; done?: boolean };

/** Channel setup guide: numbered cards, later steps locked, finished ones summarised and reopenable (WhatsApp's pattern). */
export function StepList({
  steps,
  reached,
  open,
  onOpen,
  body,
  canManage,
}: {
  steps: GuideStep[];
  reached: number;
  open: string;
  onOpen: (id: string) => void;
  body: (id: string) => ReactNode;
  canManage: boolean;
}) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const done = s.done ?? i < reached,
          locked = !done && i > reached,
          active = open === s.id && !locked;
        return (
          <li key={s.id}>
            <Card className={`gap-0 p-0 shadow-none ${active ? "border-l-4 border-l-guide-now ring-1 ring-guide-now/30" : ""}`}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(s.id)}
                className="flex w-full items-center gap-4 p-5 text-left disabled:cursor-not-allowed"
              >
                <StepDot n={i + 1} done={done} active={active} />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${locked ? "text-muted-foreground" : ""}`}>{s.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {done && !active && s.summary ? s.summary : s.hint}
                  </p>
                </div>
                {locked ? (
                  <Lock className="size-4 text-muted-foreground" />
                ) : done && !active ? (
                  <span className="text-xs text-guide-done">Done · Edit</span>
                ) : null}
              </button>
              {active && (
                <fieldset disabled={!canManage} className="border-t p-5">
                  {body(s.id)}
                </fieldset>
              )}
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
