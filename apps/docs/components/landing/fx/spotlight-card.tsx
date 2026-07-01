"use client";

import { type CSSProperties, type ElementType, type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Hairline card with a cursor-following radial glow. Interactive (pointer tracking + hover
// state), so it is a client leaf. The pointer position is written straight to CSS custom
// properties through a ref (transient value, never state), so moving the cursor does not
// re-render; only the hover boolean is state.
export function SpotlightCard({
  children,
  className,
  style,
  glow = "var(--v-purple)",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  glow?: string;
  as?: ElementType;
}): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const [hover, setHover] = useState(false);

  function onMove(event: React.MouseEvent<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - r.left}px`);
    el.style.setProperty("--my", `${event.clientY - r.top}px`);
  }

  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("relative overflow-hidden", className)}
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)",
        background: "var(--surface-card)",
        transition:
          "border-color var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)",
        borderColor: hover
          ? "color-mix(in srgb, var(--v-glow) 40%, var(--border-default))"
          : "var(--border-default)",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          opacity: hover ? 1 : 0,
          transition: "opacity var(--duration-base) var(--ease-out)",
          background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${glow} 18%, transparent), transparent 60%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </Tag>
  );
}
