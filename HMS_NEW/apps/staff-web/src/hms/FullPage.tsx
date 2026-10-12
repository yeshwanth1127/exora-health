import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmLeave } from "./leave";

export function FullPage({
  title,
  description,
  back,
  onBack,
  summary,
  children,
}: {
  title: string;
  description: string;
  back: string;
  onBack: () => void;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => {
          if (confirmLeave()) onBack();
        }}
      >
        <ArrowLeft />
        {back}
      </Button>
      <header className="flex items-start justify-between gap-8 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {summary}
      </header>
      {children}
    </section>
  );
}
