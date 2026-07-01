"use client";

import { SiAnthropic, SiDeepl, SiGooglegemini } from "@icons-pack/react-simple-icons";
import { motion, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OpenAiIcon } from "./openai-icon";

// Decorative animated mini-demos ("skeletons") for the feature bento. Each is self-contained,
// lightweight (CSS + motion, no canvas), and animates on scroll-into-view; under
// prefers-reduced-motion it renders a static settled frame. The parent cell marks the
// skeleton wrapper aria-hidden, so these carry no accessible content.

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

type FromTarget = { opacity?: number; x?: number; y?: number };

// A hairline mono panel shared by several skeletons.
function Panel({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return (
    <div
      className={cn(
        "rounded-lg border border-fd-border p-3 font-mono text-[11.5px] leading-relaxed",
        className,
      )}
      style={{ background: "var(--surface-bg)" }}
    >
      {children}
    </div>
  );
}

// Fade/slide a block in when it scrolls into view; render it statically under reduced motion.
function Reveal({
  children,
  className,
  delay = 0,
  from = { opacity: 0, y: 6 },
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: FromTarget;
}): ReactNode {
  const reduced = useReducedMotion() ?? false;
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={from}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        transition: { duration: 0.45, delay, ease: EASE },
      }}
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

// ---- A: incremental (diff to lock) ----------------------------------------
function LockGlyph({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <motion.svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      initial={reduced ? false : { opacity: 0, scale: 0.7 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
      animate={reduced ? { opacity: 1, scale: 1 } : undefined}
      viewport={reduced ? undefined : VIEWPORT}
      transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
      style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--v-glow) 55%, transparent))" }}
    >
      <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="var(--v-glow)" strokeWidth="1.6" />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="var(--v-glow)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="1.4" fill="var(--v-glow)" />
    </motion.svg>
  );
}

export function IncrementalSkeleton(): ReactNode {
  const reduced = useReducedMotion() ?? false;
  return (
    <Panel className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <Reveal className="flex items-center gap-2">
          <span style={{ color: "var(--v-glow)" }}>+</span>
          <span className="text-fd-muted-foreground">&quot;cart.checkout&quot;</span>
          <span
            className="rounded border px-1.5 py-px text-[10px]"
            style={{
              color: "var(--v-glow)",
              borderColor: "color-mix(in srgb, var(--v-glow) 45%, var(--border-default))",
            }}
          >
            changed
          </span>
        </Reveal>
        <Reveal delay={0.1} className="flex items-center gap-2 opacity-55">
          <span className="text-fd-muted-foreground">&quot;cart.total&quot;</span>
          <span className="text-[10px] text-fd-muted-foreground">unchanged</span>
        </Reveal>
        <Reveal delay={0.18} className="flex items-center gap-2 opacity-55">
          <span className="text-fd-muted-foreground">&quot;nav.home&quot;</span>
          <span className="text-[10px] text-fd-muted-foreground">unchanged</span>
        </Reveal>
      </div>
      <LockGlyph reduced={reduced} />
    </Panel>
  );
}

// ---- B: provider (gliding selection over a vertical stack) -----------------
const PROVIDER_LOGOS = [
  {
    key: "anthropic",
    name: "Anthropic",
    icon: <SiAnthropic size={18} color="currentColor" aria-hidden="true" />,
  },
  { key: "openai", name: "OpenAI", icon: <OpenAiIcon size={18} /> },
  {
    key: "gemini",
    name: "Gemini",
    icon: <SiGooglegemini size={18} color="currentColor" aria-hidden="true" />,
  },
  {
    key: "deepl",
    name: "DeepL",
    icon: <SiDeepl size={18} color="currentColor" aria-hidden="true" />,
  },
] as const;
const PROVIDER_ROW = 44;

export function ProviderSkeleton(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const inView = useInView(ref, { amount: 0.4 });
  const [selected, setSelected] = useState(0);
  const active = inView && !reduced;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSelected((current) => (current + 1) % PROVIDER_LOGOS.length);
    }, 1400);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div ref={ref} className="relative">
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 rounded-lg border"
        style={{
          height: `${PROVIDER_ROW - 6}px`,
          top: "3px",
          borderColor: "color-mix(in srgb, var(--v-glow) 45%, var(--border-default))",
          background: "color-mix(in srgb, var(--v-glow) 12%, transparent)",
        }}
        animate={{ y: selected * PROVIDER_ROW }}
        transition={reduced ? { duration: 0 } : { duration: 0.5, ease: EASE }}
      />
      <div className="relative flex flex-col">
        {PROVIDER_LOGOS.map((provider) => (
          <div
            key={provider.key}
            className="flex items-center gap-2.5 px-2.5"
            style={{ height: `${PROVIDER_ROW}px` }}
          >
            <span className="text-[color:var(--accent)]">{provider.icon}</span>
            <span
              className="text-[13px] font-medium text-fd-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {provider.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- C: safety (ICU / placeholder integrity check) ------------------------
function CheckDraw({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <motion.path
        d="M4 12.5 L10 18 L20 6"
        stroke="var(--v-glow)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        whileInView={reduced ? undefined : { pathLength: 1 }}
        animate={reduced ? { pathLength: 1 } : undefined}
        viewport={reduced ? undefined : VIEWPORT}
        transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
      />
    </svg>
  );
}

export function SafetySkeleton(): ReactNode {
  const reduced = useReducedMotion() ?? false;
  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">&quot;Hi </span>
        <span
          className="rounded px-1 py-px text-[color:var(--v-glow)]"
          style={{ background: "color-mix(in srgb, var(--v-glow) 14%, transparent)" }}
        >
          {"{name}"}
        </span>
        <span className="text-fd-muted-foreground">&quot;</span>
        <CheckDraw reduced={reduced} />
      </div>
      <div className="flex items-center gap-2 opacity-45">
        <span className="text-fd-muted-foreground line-through">&quot;Hi {"{}"}&quot;</span>
        <span className="text-[10px] text-[color:var(--v-pink)]">withheld</span>
      </div>
    </Panel>
  );
}

// ---- D: environment (masked env-var value, protected) ---------------------
const MASK_DOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function ShieldGlyph({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="ms-auto shrink-0"
      initial={reduced ? false : { opacity: 0, scale: 0.7 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
      animate={reduced ? { opacity: 1, scale: 1 } : undefined}
      viewport={reduced ? undefined : VIEWPORT}
      transition={{ duration: 0.5, delay: 0.6, ease: EASE }}
      style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--v-glow) 55%, transparent))" }}
    >
      <path
        d="M12 3 4 6v5c0 4.5 3.2 7.5 8 9 4.8-1.5 8-4.5 8-9V6l-8-3Z"
        stroke="var(--v-glow)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="var(--v-glow)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export function EnvSkeleton(): ReactNode {
  const reduced = useReducedMotion() ?? false;
  return (
    <Panel className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span style={{ color: "var(--v-glow-soft)" }}>ANTHROPIC_API_KEY</span>
      <span className="text-fd-muted-foreground">=</span>
      <span className="flex items-center gap-1">
        {MASK_DOTS.map((dot, i) => (
          <motion.span
            key={dot}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--text-muted)" }}
            initial={reduced ? false : { opacity: 0, scale: 0 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            animate={reduced ? { opacity: 1, scale: 1 } : undefined}
            viewport={reduced ? undefined : VIEWPORT}
            transition={{ duration: 0.25, delay: i * 0.05, ease: EASE }}
          />
        ))}
      </span>
      <ShieldGlyph reduced={reduced} />
    </Panel>
  );
}

// ---- E: one engine (CLI + SDK converge into a single core) ----------------
const CONNECTOR_PATHS = ["M0 16 C 24 16, 24 28, 46 28", "M0 40 C 24 40, 24 28, 46 28"] as const;

function Connectors({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <svg
      width="48"
      height="56"
      viewBox="0 0 48 56"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {CONNECTOR_PATHS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="color-mix(in srgb, var(--v-glow) 60%, transparent)"
          strokeWidth="1.6"
          fill="none"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          whileInView={reduced ? undefined : { pathLength: 1, opacity: 1 }}
          animate={reduced ? { pathLength: 1, opacity: 1 } : undefined}
          viewport={reduced ? undefined : VIEWPORT}
          transition={{ duration: 0.6, delay: 0.2 + i * 0.1, ease: EASE }}
        />
      ))}
    </svg>
  );
}

function CoreNode({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <motion.div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        border: "1px solid color-mix(in srgb, var(--v-glow) 50%, var(--border-default))",
        background: "color-mix(in srgb, var(--v-glow) 12%, transparent)",
        boxShadow: "0 0 16px -4px var(--v-glow)",
      }}
      initial={reduced ? false : { opacity: 0, scale: 0.7 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
      animate={reduced ? { opacity: 1, scale: 1 } : undefined}
      viewport={reduced ? undefined : VIEWPORT}
      transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full motion-reduce:animate-none animate-pulse"
        style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
      />
    </motion.div>
  );
}

export function OneEngineSkeleton(): ReactNode {
  const reduced = useReducedMotion() ?? false;
  return (
    <Panel className="flex items-center gap-2">
      <div className="flex flex-col gap-2">
        <Reveal
          from={{ opacity: 0, x: -8 }}
          className="rounded-md border border-fd-border px-2 py-1 text-fd-foreground"
        >
          <span style={{ color: "var(--v-glow)" }}>$</span> verbatra translate
        </Reveal>
        <Reveal
          delay={0.1}
          from={{ opacity: 0, x: -8 }}
          className="rounded-md border border-fd-border px-2 py-1 text-fd-foreground"
        >
          sdk.translate()
        </Reveal>
      </div>
      <Connectors reduced={reduced} />
      <CoreNode reduced={reduced} />
    </Panel>
  );
}

// ---- F: dry run / watch ----------------------------------------------------
export function DryRunSkeleton(): ReactNode {
  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full motion-reduce:animate-none animate-pulse"
          style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
        />
        <span className="text-fd-muted-foreground">watching en.json</span>
      </div>
      <Reveal delay={0.15} className="text-fd-muted-foreground">
        <span style={{ color: "var(--v-glow)" }}>$</span> verbatra translate --dry-run
      </Reveal>
      <Reveal delay={0.3} className="text-[color:var(--text-faint)]">
        would send 3 keys · writes nothing
      </Reveal>
    </Panel>
  );
}
