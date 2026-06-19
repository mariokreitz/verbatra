"use client";

import { useEffect, useRef, useState } from "react";

// A mocked, automated verbatra run. No network, no provider call, no key: the German
// values are hardcoded and the output is deterministic. It dramatizes the real mechanics
// from the docs: a run sorts keys into buckets (new, changed, unchanged), sends only new
// and changed keys, and returns a RunSummary. The loop plays a first run, then changes one
// source value and reruns, so verbatra touches exactly that one key. It starts when the
// panel scrolls into view and honors prefers-reduced-motion by showing the settled end
// state with no animation.

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

const FINAL_TARGET: Record<string, string> = {
  "cart.checkout": "Jetzt bezahlen",
  "cart.empty": "Leer",
  "cart.total": "Gesamt",
  "nav.home": "Startseite",
  "nav.about": "Über uns",
  "auth.signin": "Anmelden",
};

type Summary = {
  translated: number;
  unchanged: number;
  orphaned: number;
  skipped: number;
  withheld: number;
};

type Bucket = "new" | "changed" | "unchanged";
type Dict = Record<string, string>;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const germanFor = (key: string, value: string | undefined) =>
  GERMAN[`${key}|${value}`] ?? "[mocked]";

export function Showcase() {
  const [source, setSource] = useState<Dict>({ ...INITIAL_SOURCE });
  const [target, setTarget] = useState<Dict>({ ...INITIAL_TARGET });
  const [lock, setLock] = useState<Dict>({ ...INITIAL_LOCK });
  const [typing, setTyping] = useState<{ key: string; text: string } | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [narration, setNarration] = useState("verbatra translate");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let cancelled = false;
    let started = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function typeInto(key: string, value: string, src: Dict, tgt: Dict, lck: Dict) {
      for (let i = 1; i <= value.length; i += 1) {
        if (cancelled) return;
        setTyping({ key, text: value.slice(0, i) });
        await delay(38);
      }
      setTyping(null);
      tgt[key] = value;
      lck[key] = src[key] ?? "";
      setTarget({ ...tgt });
      setLock({ ...lck });
    }

    async function runOnce(src: Dict, tgt: Dict, lck: Dict): Promise<Summary | null> {
      const sent = KEYS.filter((key) => !(key in tgt) || src[key] !== lck[key]);
      const done: string[] = [];
      for (const key of sent) {
        await typeInto(key, germanFor(key, src[key]), src, tgt, lck);
        if (cancelled) return null;
        done.push(key);
        setFresh([...done]);
        await delay(140);
      }
      return {
        translated: sent.length,
        unchanged: KEYS.length - sent.length,
        orphaned: 0,
        skipped: 0,
        withheld: 0,
      };
    }

    function idle(src: Dict, tgt: Dict, lck: Dict) {
      setSource({ ...src });
      setTarget({ ...tgt });
      setLock({ ...lck });
      setFresh([]);
      setTyping(null);
      setSummary(null);
      setNarration("verbatra translate");
    }

    async function cycle() {
      while (!cancelled) {
        const src = { ...INITIAL_SOURCE };
        const tgt = { ...INITIAL_TARGET };
        const lck = { ...INITIAL_LOCK };
        idle(src, tgt, lck);
        await delay(1000);
        setNarration("First run, sending the new keys");
        const first = await runOnce(src, tgt, lck);
        if (cancelled || !first) return;
        setSummary(first);
        setNarration("Three new keys filled in, three already current");
        await delay(2400);

        src["cart.checkout"] = "Pay now";
        setSource({ ...src });
        setFresh([]);
        setNarration("One source value changes");
        await delay(1700);

        setNarration("Second run, sending only the changed key");
        const second = await runOnce(src, tgt, lck);
        if (cancelled || !second) return;
        setSummary(second);
        setNarration("One key re-translated, the rest untouched");
        await delay(3600);
      }
    }

    function showStaticFinal() {
      setSource({ ...INITIAL_SOURCE, "cart.checkout": "Pay now" });
      setTarget({ ...FINAL_TARGET });
      setLock({ ...INITIAL_SOURCE, "cart.checkout": "Pay now" });
      setFresh(["cart.checkout"]);
      setSummary({ translated: 1, unchanged: 5, orphaned: 0, skipped: 0, withheld: 0 });
      setNarration("Change one key, verbatra touches one key");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started) continue;
          started = true;
          if (reduce) showStaticFinal();
          else void cycle();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  function bucket(key: string): Bucket {
    if (!(key in target)) return "new";
    if (source[key] !== lock[key]) return "changed";
    return "unchanged";
  }

  return (
    <div
      ref={rootRef}
      className="not-prose overflow-hidden rounded-2xl border border-fd-border bg-fd-card"
      style={{
        borderInlineStart: "2px solid var(--v-glow)",
        boxShadow: "0 30px 80px -44px color-mix(in srgb, var(--v-purple) 38%, transparent)",
      }}
    >
      <div className="flex items-center gap-3 border-b border-fd-border px-5 py-3">
        <span className="font-mono text-xs text-fd-muted-foreground">
          <span style={{ color: "var(--v-glow)" }}>$</span> verbatra translate
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
          mocked output, no provider called
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

      <div className="flex items-center gap-2.5 border-t border-fd-border px-5 py-3.5 font-mono text-xs text-fd-muted-foreground">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--v-glow)" }}
          aria-hidden="true"
        />
        {narration}
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
          <span className="text-[#5c5c72] italic">The RunSummary appears here.</span>
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
