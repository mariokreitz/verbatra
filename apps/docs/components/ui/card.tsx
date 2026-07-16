import type { CSSProperties, ReactNode } from "react";

/** Props for the docs Card; `signature` adds the glow start-edge rule and panel shadow. */
export type CardProps = {
  signature?: boolean;
  padded?: boolean;
  children: ReactNode;
  className?: string;
};

const BASE = "not-prose rounded-2xl border border-fd-border bg-fd-card text-fd-foreground";

/** The design-system card surface; the signature variant uses a logical start-edge border so the rule sits on the correct side under RTL. */
export default function Card({
  signature = false,
  padded = true,
  children,
  className,
}: CardProps): ReactNode {
  const classes = `${BASE}${padded ? " p-5" : ""}${className ? ` ${className}` : ""}`;
  const style: CSSProperties | undefined = signature
    ? { borderInlineStart: "2px solid var(--v-glow)", boxShadow: "var(--shadow-panel)" }
    : undefined;

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
