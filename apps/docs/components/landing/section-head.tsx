import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

// Eyebrow + display heading + optional lead. Presentational, so it stays a server
// component (no "use client").
export function SectionHead({
  eyebrow,
  title,
  lead,
  align = "left",
  maxWidth = "640px",
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  maxWidth?: string;
  id?: string;
}): ReactNode {
  const centered = align === "center";
  return (
    <div
      className={centered ? "mx-auto text-center" : "text-left"}
      style={centered ? { maxWidth } : undefined}
    >
      {eyebrow ? <Eyebrow center={centered}>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="mt-4 font-semibold text-fd-foreground"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "var(--tracking-tight)",
          fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)",
          lineHeight: 1.08,
        }}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed text-fd-muted-foreground",
            centered && "mx-auto",
          )}
          style={{ maxWidth: centered ? maxWidth : "580px" }}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
