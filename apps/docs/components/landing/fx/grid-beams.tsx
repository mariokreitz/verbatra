"use client";

import type { ReactNode } from "react";
import { GRID_PATTERN_STYLE } from "./grid-pattern";

const BEAMS = [0, 1, 2] as const;

export function GridBeams({
  fade = "radial-gradient(ellipse 70% 60% at 50% 0%, #000 35%, transparent 78%)",
  beams = true,
}: {
  fade?: string;
  beams?: boolean;
}): ReactNode {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          ...GRID_PATTERN_STYLE,
          opacity: 0.5,
          WebkitMaskImage: fade,
          maskImage: fade,
        }}
      />
      {beams
        ? BEAMS.map((i) => (
            <span
              key={i}
              className="vk-beam absolute"
              style={{
                top: "-30%",
                left: `${18 + i * 30}%`,
                width: "1px",
                height: "40%",
                background: "linear-gradient(to bottom, transparent, var(--v-glow), transparent)",
                opacity: 0.6,
                animationDuration: `${6 + i * 1.7}s`,
                animationDelay: `${i * 1.4}s`,
              }}
            />
          ))
        : null}
    </div>
  );
}
