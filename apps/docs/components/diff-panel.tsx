"use client";

import { useEffect, useRef, useState } from "react";

// The signature element: a tiny live diff that shows "translate only what changed".
// Unchanged keys sit dim; the one changed value types in on the deep brand purple and
// settles to the glow lavender. Honors prefers-reduced-motion by rendering the final
// state with no animation, and renders the final state on the server / without JS.

type Row = {
  key: string;
  source: string;
  target: string;
  changed?: boolean;
};

const DEFAULT_ROWS: ReadonlyArray<Row> = [
  { key: "cart.checkout", source: "Checkout", target: "Zur Kasse", changed: true },
  { key: "cart.empty", source: "Empty", target: "Leer" },
  { key: "cart.total", source: "Total", target: "Gesamt" },
];

export function DiffPanel({
  rows = DEFAULT_ROWS,
  sourceFile = "en.json",
  targetFile = "de.json",
}: {
  rows?: ReadonlyArray<Row>;
  sourceFile?: string;
  targetFile?: string;
}) {
  const changed = rows.find((r) => r.changed);
  const full = changed?.target ?? "";

  // Start fully shown so the server render and no-JS users see the final, correct state.
  const [count, setCount] = useState(full.length);
  const [settled, setSettled] = useState(true);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!full) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const node = ref.current;
    if (!node) return;

    let started = false;
    let typer: ReturnType<typeof setInterval> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    // Reset to empty, then type in once the panel scrolls into view.
    setCount(0);
    setSettled(false);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started) continue;
          started = true;
          let i = 0;
          typer = setInterval(() => {
            i += 1;
            setCount(i);
            if (i >= full.length) {
              if (typer) clearInterval(typer);
              settleTimer = setTimeout(() => setSettled(true), 450);
            }
          }, 55);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (typer) clearInterval(typer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [full]);

  const typed = full.slice(0, count);
  const typing = count > 0 && count < full.length;
  const changedStyle = settled
    ? { color: "var(--v-glow)" }
    : {
        color: "var(--v-purple)",
        textShadow: "0 0 10px color-mix(in srgb, var(--v-purple) 55%, transparent)",
      };

  return (
    <figure
      ref={ref}
      aria-label="A diff showing only the changed translation key being re-translated"
      className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card p-4 font-mono text-sm shadow-sm sm:p-5"
      style={{ borderInlineStart: "2px solid var(--v-glow)" }}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="text-xs text-fd-muted-foreground">{sourceFile}</div>
        <div className="text-xs text-fd-muted-foreground">{targetFile}</div>

        {rows.map((row) => (
          <DiffRow
            key={row.key}
            row={row}
            typed={typed}
            typing={typing}
            changedStyle={changedStyle}
          />
        ))}
      </div>
      <figcaption className="mt-4 text-xs text-fd-muted-foreground">
        Only the changed key is sent to the provider. Current keys are left untouched.
      </figcaption>
    </figure>
  );
}

function DiffRow({
  row,
  typed,
  typing,
  changedStyle,
}: {
  row: Row;
  typed: string;
  typing: boolean;
  changedStyle: React.CSSProperties;
}) {
  return (
    <>
      <div className="text-fd-muted-foreground/70">
        <span className="text-fd-muted-foreground">&quot;{row.key}&quot;</span>: &quot;
        {row.source}&quot;
      </div>
      <div className={row.changed ? "" : "text-fd-muted-foreground/60"}>
        <span className="text-fd-muted-foreground">&quot;{row.key}&quot;</span>:{" "}
        {row.changed ? (
          <span style={changedStyle}>
            &quot;{typed}&quot;
            {typing ? <span className="opacity-70">▍</span> : null}
          </span>
        ) : (
          <span>&quot;{row.target}&quot;</span>
        )}
      </div>
    </>
  );
}
