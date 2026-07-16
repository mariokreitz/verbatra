"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Line = { kind: "command" | "output"; text: string };

/** Props for the animated Terminal; `outputs` maps a command index to its output lines. */
export type TerminalProps = {
  commands: ReadonlyArray<string>;
  outputs?: Readonly<Record<number, ReadonlyArray<string>>>;
  title?: string;
  typingSpeed?: number;
  delayBetweenCommands?: number;
  initialDelay?: number;
  /** When false, the sequence types once and then holds the settled state. */
  loop?: boolean;
  className?: string;
};

const TRAFFIC_LIGHTS = ["#ff5f56", "#ffbd2e", "#27c93f"] as const;
const HOLD_PAUSE_MS = 2600;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lets the module-scope animation helpers drive component state without being redefined per render. */
type PlayerContext = {
  isCancelled: () => boolean;
  setTyping: (value: string | null) => void;
  pushLine: (line: Line) => void;
  reset: () => void;
  scroll: () => void;
  commands: ReadonlyArray<string>;
  outputs?: Readonly<Record<number, ReadonlyArray<string>>>;
  typingSpeed: number;
  delayBetweenCommands: number;
  initialDelay: number;
  loop: boolean;
};

async function typeCommand(ctx: PlayerContext, cmd: string): Promise<boolean> {
  for (let c = 1; c <= cmd.length; c += 1) {
    if (ctx.isCancelled()) return false;
    ctx.setTyping(cmd.slice(0, c));
    ctx.scroll();
    await delay(ctx.typingSpeed);
  }
  return true;
}

async function printOutputs(ctx: PlayerContext, lines: ReadonlyArray<string>): Promise<boolean> {
  for (const text of lines) {
    if (ctx.isCancelled()) return false;
    ctx.pushLine({ kind: "output", text });
    ctx.scroll();
    await delay(90);
  }
  return true;
}

async function runCommand(
  ctx: PlayerContext,
  cmd: string,
  out: ReadonlyArray<string>,
): Promise<boolean> {
  if (!(await typeCommand(ctx, cmd))) return false;
  ctx.setTyping(null);
  ctx.pushLine({ kind: "command", text: cmd });
  ctx.scroll();
  await delay(320);
  if (!(await printOutputs(ctx, out))) return false;
  await delay(ctx.delayBetweenCommands);
  return true;
}

async function playLoop(ctx: PlayerContext): Promise<void> {
  while (!ctx.isCancelled()) {
    ctx.reset();
    await delay(ctx.initialDelay);
    for (let i = 0; i < ctx.commands.length; i += 1) {
      const cmd = ctx.commands[i];
      if (cmd === undefined) continue;
      if (!(await runCommand(ctx, cmd, ctx.outputs?.[i] ?? []))) return;
    }
    if (!ctx.loop) return;
    await delay(HOLD_PAUSE_MS);
  }
}

function buildSettled(
  commands: ReadonlyArray<string>,
  outputs?: Readonly<Record<number, ReadonlyArray<string>>>,
): Line[] {
  const settled: Line[] = [];
  commands.forEach((cmd, i) => {
    settled.push({ kind: "command", text: cmd });
    for (const text of outputs?.[i] ?? []) settled.push({ kind: "output", text });
  });
  return settled;
}

/** Brand-token color for a shell token (check glyph, flags, quoted strings, numbers), or undefined for the base color. */
function tokenColor(token: string): string | undefined {
  if (token === "✓") return "var(--v-glow)";
  if (token.startsWith("-")) return "var(--v-glow-soft)";
  if (/^["'].*["']$/.test(token)) return "var(--v-pink)";
  if (/^\d+$/.test(token)) return "var(--v-glow)";
  return undefined;
}

function HighlightedText({ text, base }: { text: string; base: string }): ReactNode {
  const tokens = text.split(" ");
  return (
    <>
      {tokens.map((token, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static per-line tokenization can repeat tokens (separators), so the index disambiguates.
        <span key={i} style={{ color: tokenColor(token) ?? base }}>
          {i > 0 ? " " : ""}
          {token}
        </span>
      ))}
    </>
  );
}

function LineRow({ line }: { line: Line }): ReactNode {
  if (line.kind === "command") {
    return (
      <div className="whitespace-pre-wrap">
        <span style={{ color: "var(--v-glow)" }}>$</span>{" "}
        <HighlightedText text={line.text} base="var(--text-strong)" />
      </div>
    );
  }
  return (
    <div className="whitespace-pre-wrap">
      <HighlightedText text={line.text} base="var(--text-muted)" />
    </div>
  );
}

/**
 * A macOS-style terminal window that types each command and prints its output
 * once scrolled into view, looping when `loop` is true. Under reduced motion
 * it renders the settled transcript at once. The animated body is decorative
 * (aria-hidden); an sr-only transcript is its accessible equivalent.
 */
export function Terminal({
  commands,
  outputs,
  title,
  typingSpeed = 45,
  delayBetweenCommands = 900,
  initialDelay = 500,
  loop = true,
  className,
}: TerminalProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<Line[]>([]);
  const [typing, setTyping] = useState<string | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let cancelled = false;
    let started = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx: PlayerContext = {
      isCancelled: () => cancelled,
      setTyping,
      pushLine: (line) => setHistory((h) => [...h, line]),
      reset: () => {
        setHistory([]);
        setTyping("");
      },
      scroll: () => {
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },
      commands,
      outputs,
      typingSpeed,
      delayBetweenCommands,
      initialDelay,
      loop,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started) continue;
          started = true;
          if (reduce) {
            setHistory(buildSettled(commands, outputs));
            setTyping(null);
          } else {
            void playLoop(ctx);
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [commands, outputs, typingSpeed, delayBetweenCommands, initialDelay, loop]);

  return (
    <div
      ref={rootRef}
      className={cn("not-prose overflow-hidden rounded-2xl border border-fd-border", className)}
      style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-panel)" }}
    >
      <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          {TRAFFIC_LIGHTS.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          ))}
        </span>
        {title ? (
          <span className="ms-2 font-mono text-xs text-fd-muted-foreground">{title}</span>
        ) : null}
      </div>

      <div className="sr-only">
        <p>An example verbatra command-line session.</p>
        <ol>
          {commands.map((cmd, i) => (
            <li key={cmd}>
              <span>{cmd}</span>
              <ul>
                {(outputs?.[i] ?? []).map((out) => (
                  <li key={out}>{out}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <div
        ref={scrollRef}
        aria-hidden="true"
        className="h-80 overflow-y-auto px-4 py-4 font-mono text-[13px] leading-relaxed"
        style={{ background: "var(--surface-bg)" }}
      >
        {history.map((line) => (
          <LineRow key={`${line.kind}:${line.text}`} line={line} />
        ))}
        {typing !== null ? (
          <div className="whitespace-pre-wrap">
            <span style={{ color: "var(--v-glow)" }}>$</span>{" "}
            <HighlightedText text={typing} base="var(--text-strong)" />
            <span className="ms-0.5 animate-pulse" style={{ color: "var(--v-glow)" }}>
              &#9613;
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
