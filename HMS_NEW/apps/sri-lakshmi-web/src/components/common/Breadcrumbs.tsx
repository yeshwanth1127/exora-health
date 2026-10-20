import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/** Shared trail for inner pages (department style): first crumb gets a back arrow, last is current. */
export function Breadcrumbs({ items, children }: { items: Crumb[]; children?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs sm:text-sm text-stone-500">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <span key={item.label} className="flex items-center gap-2 min-w-0">
              {i > 0 && <ChevronRight className="size-3 text-stone-400 shrink-0" />}
              {last ? (
                <span className="font-semibold text-[#121212] truncate" aria-current="page">{item.label}</span>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-[#154734] font-medium transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {i === 0 && <ArrowLeft className="size-3.5" />}
                  <span>{item.label}</span>
                </button>
              ) : (
                <span className="shrink-0">{item.label}</span>
              )}
            </span>
          );
        })}
      </nav>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
