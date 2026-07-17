"use client";

import { type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function CardSpotlight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the pointer handlers drive a purely decorative hover spotlight, not an interactive control, so no role or keyboard equivalent applies.
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("relative overflow-hidden rounded-xl border border-fd-border", className)}
      style={{
        background: "var(--surface-card)",
        transition: "border-color var(--duration-base) var(--ease-out)",
        borderColor: hover
          ? "color-mix(in srgb, var(--v-glow) 35%, var(--border-default))"
          : "var(--border-default)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hover ? 1 : 0,
          transition: "opacity var(--duration-base) var(--ease-out)",
          background:
            "radial-gradient(350px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--v-glow) 12%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hover ? 1 : 0,
          transition: "opacity var(--duration-base) var(--ease-out)",
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--v-glow) 42%, transparent) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
          WebkitMaskImage:
            "radial-gradient(300px circle at var(--mx, 50%) var(--my, 50%), #000 0%, transparent 65%)",
          maskImage:
            "radial-gradient(300px circle at var(--mx, 50%) var(--my, 50%), #000 0%, transparent 65%)",
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
