import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { faqAnswer } from "../content";

export function Faq({ questions }: { questions: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="hje-faq">
      {questions.map((q, i) => (
        <div
          className={"hje-faq-item" + (open === i ? " is-open" : "")}
          key={q}
        >
          <h3>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={"answer-" + i}
              id={"question-" + i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {q}
              {open === i ? <Minus size={18} /> : <Plus size={18} />}
            </button>
          </h3>
          <div
            id={"answer-" + i}
            role="region"
            aria-labelledby={"question-" + i}
            hidden={open !== i}
          >
            <p>{faqAnswer(q)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
