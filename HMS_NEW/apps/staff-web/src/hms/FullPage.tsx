import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestLeave } from "./leave";

export function FullPage({
  title,
  back,
  onBack,
  summary,
  children,
}: {
  title: string;
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
          requestLeave(onBack);
        }}
      >
        <ArrowLeft />
        {back}
      </Button>
      <header className="flex items-start justify-between gap-8 border-b pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {summary}
      </header>
      {children}
    </section>
  );
}
