import { useContext, type ReactNode } from "react";
import { previewHref } from "../../previewHref";
import { useWebsite } from "../../Runtime";
import { Nav } from "../shared";

export function A({
  to,
  children,
  className = "",
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const { template, bound } = useWebsite();

  const go = useContext(Nav);
  const href = previewHref(to, template, bound);
  return (
    <a
      href={href}
      className={className}
      {...props}
      onClick={(e) => {
        if (
          to.startsWith("#") ||
          e.button ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}
