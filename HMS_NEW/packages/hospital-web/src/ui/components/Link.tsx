import { useContext, type ReactNode } from "react";
import { previewHref } from "../previewHref";
import { useWebsite } from "../Runtime";
import { Router } from "../shared";

export function Link({
  to,
  children,
  className = "",
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const { template, bound } = useWebsite();

  const go = useContext(Router);
  const href = previewHref(to, template, bound);
  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}
