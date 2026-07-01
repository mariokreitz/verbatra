"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Aceternity-style "logo cloud with swap animation": a grid of logo slots fed from a larger
// pool. Every `intervalMs` the visible logos swap to others from the pool, entering from the
// right and exiting to the left with a blur that clears, staggered per slot for a wave. When
// the pool is not larger than the visible slots (or reduced motion is requested) it renders a
// static set with a single reveal and no swapping. The animated grid is aria-hidden; an
// sr-only list names every logo in the pool.
export type SwapLogo = { key: string; name: string; icon: ReactNode };

const EASE = [0.22, 1, 0.36, 1] as const;

export function SwapLogoCloud({
  logos,
  visibleCount,
  label,
  gridClassName,
  intervalMs = 3000,
}: {
  logos: ReadonlyArray<SwapLogo>;
  visibleCount: number;
  label: string;
  gridClassName: string;
  intervalMs?: number;
}): ReactNode {
  const reduced = useReducedMotion() ?? false;
  const [offset, setOffset] = useState(0);
  const canSwap = !reduced && logos.length > visibleCount;

  useEffect(() => {
    if (!canSwap) return;
    const id = setInterval(() => {
      setOffset((current) => (current + visibleCount) % logos.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [canSwap, visibleCount, logos.length, intervalMs]);

  if (logos.length === 0) return null;

  const slots: SwapLogo[] = [];
  for (let i = 0; i < visibleCount; i += 1) {
    const item = logos[(offset + i) % logos.length];
    if (item) slots.push(item);
  }

  return (
    <div>
      {/* The full supported set for assistive tech, regardless of what is visually rotating. */}
      <ul className="sr-only">
        <li>{label}:</li>
        {logos.map((logo) => (
          <li key={logo.key}>{logo.name}</li>
        ))}
      </ul>
      <div className={cn("grid items-center gap-x-4 gap-y-8", gridClassName)} aria-hidden="true">
        {slots.map((logo, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the slots are positional and fixed in count; the swapping identity lives on the inner motion element's key.
          <div key={`slot-${i}`} className="flex items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={logo.key}
                initial={reduced ? false : { opacity: 0, x: 40, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduced ? undefined : { opacity: 0, x: -40, filter: "blur(6px)" }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.05, ease: EASE }
                }
                className="flex flex-col items-center gap-2.5"
              >
                <span className="text-[color:var(--accent)]">{logo.icon}</span>
                <span
                  className="text-[13px] font-medium text-fd-muted-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {logo.name}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
