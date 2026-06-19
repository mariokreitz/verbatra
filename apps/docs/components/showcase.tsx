"use client";

import { useState } from "react";

// A mocked, interactive verbatra run. No network, no provider call, no key: the German
// values are hardcoded and the output is deterministic. It dramatizes the real mechanics
// from the docs: a run sorts keys into buckets (new, changed, unchanged, orphaned), sends
// only new and changed keys, and returns a RunSummary. Edit one source value and rerun to
// see verbatra touch exactly that one key. Honors prefers-reduced-motion.

const KEYS = [
  "cart.checkout",
  "cart.empty",
  "cart.total",
  "nav.home",
  "nav.about",
  "auth.signin",
] as const;

const GERMAN: Record<string, string> = {
  "cart.checkout|Checkout": "Zur Kasse",
  "cart.checkout|Pay now": "Jetzt bezahlen",
  "cart.empty|Empty": "Leer",
  "cart.total|Total": "Gesamt",
  "nav.home|Home": "Startseite",
  "nav.about|About": "Über uns",
  "auth.signin|Sign in": "Anmelden",
};

const INITIAL_SOURCE: Record<string, string> = {
  "cart.checkout": "Checkout",
  "cart.empty": "Empty",
  "cart.total": "Total",
  "nav.home": "Home",
  "nav.about": "About",
  "auth.signin": "Sign in",
};
const INITIAL_TARGET: Record<string, string> = {
  "cart.empty": "Leer",
  "cart.total": "Gesamt",
  "nav.home": "Startseite",
};
const INITIAL_LOCK: Record<string, string> = {
  "cart.empty": "Empty",
  "cart.total": "Total",
  "nav.home": "Home",
};

type Summary = {
  translated: number;
  unchanged: number;
  orphaned: number;
  skipped: number;
  withheld: number;
};

type Bucket = "new" | "changed" | "unchanged";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Showcase() {
  const [source, setSource] = useState<Record<string, string>>({ ...INITIAL_SOURCE });
  const [target, setTarget] = useState<Record<string, string>>({ ...INITIAL_TARGET });
  const [lock, setLock] = useState<Record<string, string>>({ ...INITIAL_LOCK });
  const [typing, setTyping] = useState<{ key: string; text: string } | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hint, setHint] = useState("Run the first translation");

  function bucket(key: string): Bucket {
    if (!(key in target)) return "new";
    if (source[key] !== lock[key]) return "changed";
    return "unchanged";
  }
  function german(key: string): string {
    return GERMAN[`${key}|${source[key]}`] ?? "[mocked]";
  }

  async function typeKey(key: string) {
    const full = german(key);
    for (let i = 1; i <= full.length; i += 1) {
      setTyping({ key, text: full.slice(0, i) });
      await delay(45);
    }
    setTyping(null);
  }

  function finishRun(translated: number, unchanged: number) {
    setBusy(false);
    setRan(true);
    setSummary({ translated, unchanged, orphaned: 0, skipped: 0, withheld: 0 });
    setHint(
      translated === 0
        ? "Nothing changed. The provider was not called."
        : "Now edit a source key and run again.",
    );
  }

  async function run() {
    if (busy) return;
    const sent = KEYS.filter((key) => bucket(key) !== "unchanged");
    const unchanged = KEYS.length - sent.length;
    setBusy(true);
    setFresh([]);

    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextTarget = { ...target };
    const nextLock = { ...lock };
    const done: string[] = [];

    for (const key of sent) {
      if (animate) await typeKey(key);
      nextTarget[key] = german(key);
      nextLock[key] = source[key] ?? "";
      done.push(key);
      setTarget({ ...nextTarget });
      setLock({ ...nextLock });
      setFresh([...done]);
      if (animate) await delay(160);
    }

    finishRun(sent.length, unchanged);
  }

  function editKey() {
    if (busy) return;
    setSource((prev) => ({
      ...prev,
      "cart.checkout": prev["cart.checkout"] === "Checkout" ? "Pay now" : "Checkout",
    }));
    setFresh([]);
    setHint('cart.checkout is now "changed". Run again.');
  }

  function reset() {
    setSource({ ...INITIAL_SOURCE });
    setTarget({ ...INITIAL_TARGET });
    setLock({ ...INITIAL_LOCK });
    setTyping(null);
    setFresh([]);
    setRan(false);
    setBusy(false);
    setSummary(null);
    setHint("Run the first translation");
  }

  const resetDisabled = busy || (!ran && source["cart.checkout"] === "Checkout");

  return (
    <div
      className="not-prose overflow-hidden rounded-2xl border border-fd-border bg-fd-card"
      style={{
        borderInlineStart: "2px solid var(--v-glow)",
        boxShadow: "0 30px 80px -44px color-mix(in srgb, var(--v-purple) 38%, transparent)",
      }}
    >
      <div className="flex items-center gap-3 border-b border-fd-border px-5 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-fd-muted-foreground">
          verbatra translate
        </span>
        <span
          className="ms-auto inline-flex items-center gap-2 rounded-full border border-fd-border px-2.5 py-1 font-mono text-[10.5px] tracking-wide"
          style={{ color: "var(--v-glow)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--v-glow)" }}
            aria-hidden="true"
          />
          interactive demo, mocked output
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="p-5">
          <div className="mb-3 font-mono text-xs tracking-wide text-fd-muted-foreground">
            en.json (source)
          </div>
          {KEYS.map((key) => {
            const b = bucket(key);
            return (
              <div
                key={key}
                className="flex min-h-[30px] items-center gap-2 py-1 font-mono text-sm"
              >
                <span className="whitespace-nowrap text-fd-muted-foreground">
                  &quot;{key}&quot;:
                </span>
                <span className="text-fd-foreground">&quot;{source[key]}&quot;</span>
                <span
                  className="ms-auto rounded-md border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide"
                  style={chipStyle(b)}
                >
                  {b}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-fd-border p-5 sm:border-t-0 sm:border-s">
          <div className="mb-3 font-mono text-xs tracking-wide text-fd-muted-foreground">
            de.json (target)
          </div>
          {KEYS.map((key) => {
            let value: React.ReactNode;
            if (typing && typing.key === key) {
              value = <span style={typingStyle}>&quot;{typing.text}&quot;</span>;
            } else if (key in target) {
              const isFresh = fresh.includes(key);
              value = (
                <span
                  className={isFresh ? "" : "text-fd-foreground"}
                  style={isFresh ? { color: "var(--v-glow)" } : undefined}
                >
                  &quot;{target[key]}&quot;
                </span>
              );
            } else {
              value = <span style={{ color: "#5c5c72" }}>. . .</span>;
            }
            return (
              <div
                key={key}
                className="flex min-h-[30px] items-center gap-2 py-1 font-mono text-sm"
              >
                <span className="whitespace-nowrap text-fd-muted-foreground">
                  &quot;{key}&quot;:
                </span>
                {value}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-fd-border px-5 py-4">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 font-mono text-sm font-medium disabled:opacity-45"
          style={{ background: "var(--v-purple)", color: "hsl(290 60% 98%)" }}
        >
          <span style={{ opacity: 0.8 }} aria-hidden="true">
            $
          </span>
          verbatra translate
        </button>
        <button
          type="button"
          onClick={editKey}
          disabled={!ran || busy}
          className="rounded-[10px] border border-fd-border px-3.5 py-2 text-sm text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground disabled:opacity-40"
        >
          Edit a source key
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={resetDisabled}
          className="rounded-[10px] border border-fd-border px-3.5 py-2 text-sm text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground disabled:opacity-40"
        >
          Reset
        </button>
        <span className="ms-auto font-mono text-xs text-fd-muted-foreground">{hint}</span>
      </div>

      <div className="border-t border-fd-border px-5 py-4 font-mono text-sm">
        {summary ? (
          <>
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-fd-muted-foreground">
              RunSummary &middot; de
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Stat n={summary.translated} label="translated" />
              <Stat n={summary.unchanged} label="unchanged" />
              <Stat n={summary.orphaned} label="orphaned" />
              <Stat n={summary.skipped} label="skipped invalid icu" />
              <Stat n={summary.withheld} label="withheld" />
            </div>
          </>
        ) : (
          <span className="text-[#5c5c72] italic">No run yet. The RunSummary appears here.</span>
        )}
      </div>
    </div>
  );
}

const typingStyle: React.CSSProperties = {
  color: "var(--v-purple)",
  textShadow: "0 0 10px color-mix(in srgb, var(--v-purple) 55%, transparent)",
};

function chipStyle(b: Bucket): React.CSSProperties {
  if (b === "new") {
    return {
      color: "var(--v-glow)",
      borderColor: "color-mix(in srgb, var(--v-glow) 45%, var(--color-fd-border))",
    };
  }
  if (b === "changed") {
    return {
      color: "#e7b6f2",
      borderColor: "color-mix(in srgb, var(--v-purple) 55%, var(--color-fd-border))",
    };
  }
  return { color: "#6f6f86", borderColor: "var(--color-fd-border)" };
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg" style={{ color: n === 0 ? "#6f6f86" : "var(--v-glow)" }}>
        {n}
      </span>
      <span className="text-fd-muted-foreground">{label}</span>
    </span>
  );
}
