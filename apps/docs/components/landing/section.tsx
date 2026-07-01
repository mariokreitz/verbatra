import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared section shell for the centered content sections: the standard `mt-24` vertical
// rhythm, a centered container, and one of the two max widths the landing uses. Server
// component (presentational). Sections with bespoke chrome (full-width marquee, the
// effect-backed CTA, the footer) keep their own markup.
const WIDTHS = {
  md: "max-w-3xl",
  lg: "max-w-6xl",
} as const;

export function Section({
  children,
  width = "lg",
  className,
  id,
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
  id?: string;
}): ReactNode {
  return (
    <section id={id} className={cn("mx-auto mt-24 px-6", WIDTHS[width], className)}>
      {children}
    </section>
  );
}
