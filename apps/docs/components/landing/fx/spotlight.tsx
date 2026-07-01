import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A soft elliptical sweep that fades in over a section. Pure markup with a CSS animation
// class (.vk-spot), so it needs no client JS and renders meaningfully on the server. The
// sweep is disabled under prefers-reduced-motion by the .vk-spot rule in global.css.
export function Spotlight({
  fill = "var(--v-violet)",
  className,
}: {
  fill?: string;
  className?: string;
}): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className="vk-spot absolute"
        style={{
          top: "-30%",
          left: "50%",
          width: "min(1100px, 130%)",
          height: "780px",
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, ${fill} 26%, transparent), transparent 70%)`,
          filter: "blur(28px)",
        }}
      />
    </div>
  );
}
