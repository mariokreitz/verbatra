"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Aceternity "feature-block-animated-card": a dark, semi-transparent card with a subtle inset
// highlight; a dedicated visual area at the top whose edges are faded with a radial mask,
// containing a faint vertical glowing beam that travels down the center (the shared .vk-beam
// keyframe, disabled under reduced motion) and a few drifting sparkle particles (motion). The
// visual holds the pillar's skeleton; the title and body sit below. The visual is decorative
// (aria-hidden); the title/body carry the meaning. This is the animated showcase, so it is
// lively; under prefers-reduced-motion the beam and sparkles settle to a static frame.

const SPARKLES = [
  { left: "22%", top: "28%", delay: 0, duration: 3.8 },
  { left: "68%", top: "22%", delay: 0.9, duration: 4.4 },
  { left: "44%", top: "60%", delay: 1.5, duration: 4.0 },
  { left: "82%", top: "58%", delay: 0.4, duration: 4.7 },
  { left: "13%", top: "64%", delay: 1.2, duration: 4.2 },
] as const;

export function FeatureCard({
  title,
  body,
  visual,
}: {
  title: string;
  body: string;
  visual: ReactNode;
}): ReactNode {
  const reduced = useReducedMotion() ?? false;
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-fd-border"
      style={{
        background: "color-mix(in srgb, var(--surface-card) 82%, transparent)",
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, #ffffff 6%, transparent), 0 14px 36px -24px color-mix(in srgb, var(--v-purple) 55%, transparent)",
      }}
    >
      <div
        aria-hidden="true"
        className="relative flex items-center justify-center overflow-hidden border-b border-fd-border px-5"
        style={{
          minHeight: "170px",
          background: "var(--surface-bg)",
          WebkitMaskImage: "radial-gradient(125% 92% at 50% 45%, #000 55%, transparent 100%)",
          maskImage: "radial-gradient(125% 92% at 50% 45%, #000 55%, transparent 100%)",
        }}
      >
        {/* Vertical glowing beam down the center (CSS keyframe; reduced motion hides it). */}
        <span
          className="vk-beam pointer-events-none absolute"
          style={{
            left: "50%",
            top: "-15%",
            height: "55%",
            width: "1.5px",
            transform: "translateX(-50%)",
            background: "linear-gradient(to bottom, transparent, var(--v-glow), transparent)",
            opacity: 0.7,
            animationDuration: "4.5s",
          }}
        />
        {/* Drifting sparkle particles. */}
        {SPARKLES.map((sparkle) => (
          <motion.span
            key={`${sparkle.left}-${sparkle.top}`}
            className="pointer-events-none absolute h-[3px] w-[3px] rounded-full"
            style={{
              left: sparkle.left,
              top: sparkle.top,
              background: "var(--v-glow-soft)",
              boxShadow: "0 0 6px var(--v-glow)",
            }}
            initial={reduced ? { opacity: 0.4 } : { opacity: 0, y: 0 }}
            animate={reduced ? { opacity: 0.4 } : { opacity: [0, 0.75, 0], y: [0, 12, 20] }}
            transition={
              reduced
                ? undefined
                : {
                    duration: sparkle.duration,
                    delay: sparkle.delay,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }
            }
          />
        ))}
        <div className="relative w-full max-w-[20rem]">{visual}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3
          className="text-[1.18rem] font-semibold text-fd-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-fd-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
