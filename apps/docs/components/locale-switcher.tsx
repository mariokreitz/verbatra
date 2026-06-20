"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

// The landing locale switcher: a compact dropdown in the shared nav (en / de / es / fr).
// Visible glyph is the lowercase code; the accessible name is the autonym. Every option is a
// real <a href> to the same path under the target locale, so it works with JS disabled and is
// crawlable. The client code only adds the disclosure affordance and keyboard roving — the URL
// stays the single source of truth for the active locale.
//
// Routing rule (matches `hideLocale: "default-locale"`): English is unprefixed (`/…`); the
// other locales are prefixed (`/de…`, `/es…`, `/fr…`).

const LOCALES: readonly Locale[] = ["en", "de", "es", "fr"];
const DEFAULT_LOCALE: Locale = "en";

/** Strip any leading locale prefix from a pathname, returning the locale-agnostic remainder. */
function stripLocale(pathname: string): { locale: Locale; rest: string } {
  const segments = pathname.split("/");
  const first = segments[1];
  if (first && (LOCALES as readonly string[]).includes(first)) {
    const rest = `/${segments.slice(2).join("/")}`;
    return { locale: first as Locale, rest: rest === "/" ? "/" : rest.replace(/\/$/, "") };
  }
  return { locale: DEFAULT_LOCALE, rest: pathname === "/" ? "/" : pathname.replace(/\/$/, "") };
}

/** Build the href for `target` from the locale-agnostic `rest` of the current path. */
function hrefFor(target: Locale, rest: string): string {
  const base = rest === "/" ? "" : rest;
  return target === DEFAULT_LOCALE ? base || "/" : `/${target}${base}`;
}

// The VMARK chevron — the switcher's one expressive glyph (Designer's signature element).
// Muted at rest, lights to the glow on hover/open.
function MarkGlyph({ lit }: { lit: boolean }): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        transition: "filter var(--duration-fast) var(--ease-out)",
        filter: lit
          ? "drop-shadow(0 0 6px color-mix(in srgb, var(--v-glow) 60%, transparent))"
          : "none",
      }}
    >
      <path
        d="M4 4 L12 20 L20 4"
        stroke={lit ? "var(--v-glow)" : "var(--text-muted)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LocaleSwitcher(): ReactNode {
  const t = useTranslations("landing.nav");
  const pathname = usePathname() ?? "/";
  const { locale: current, rest } = stripLocale(pathname);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click and on Escape; route changes unmount/remount the page so no
  // explicit route-change close is needed beyond this.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lit = open || hover;

  return (
    <div ref={rootRef} className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("language")}
        onClick={() => setOpen((value) => !value)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs lowercase tracking-[0.12em] transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        style={{ color: lit ? "var(--text-strong)" : "var(--text-muted)" }}
      >
        <MarkGlyph lit={lit} />
        <span>{current}</span>
        <span
          aria-hidden="true"
          className="text-[0.6rem] motion-safe:transition-transform motion-safe:duration-[var(--duration-fast)]"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* A disclosure of real per-locale links — a navigation control, not a form select.
          The panel is ALWAYS in the DOM (crawlable hreflang-bearing links) and hidden only
          visually: shown when the disclosure is open OR, as a no-JS fallback, when the control
          has keyboard focus (`group-focus-within`). So with JS disabled the links are reachable
          by Tab and clickable, and with JS the button toggles them. Every option is an <a href>;
          the active locale carries aria-current plus the redundant 2px glow bar (never color
          alone). No menu/menuitem roles: a list of links is the accessible primitive here. */}
      <nav
        id={menuId}
        aria-label={t("language")}
        data-open={open ? "true" : "false"}
        className="absolute end-0 z-50 mt-2 hidden min-w-[11rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] py-1 group-focus-within:block data-[open=true]:block"
        style={{
          background: "var(--surface-raised)",
          boxShadow: "var(--shadow-panel)",
        }}
      >
        <ul>
          {LOCALES.map((locale) => {
            const active = locale === current;
            return (
              <li key={locale}>
                <a
                  href={hrefFor(locale, rest)}
                  hrefLang={locale}
                  aria-current={active ? "true" : undefined}
                  aria-label={t(`lang.${locale}`)}
                  className="relative flex items-center gap-3 py-2 ps-4 pe-4 font-mono text-xs lowercase tracking-[0.12em] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:bg-[var(--surface-hover)]"
                  style={{ color: active ? "var(--text-strong)" : "var(--text-muted)" }}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1.5 start-0 w-0.5 rounded-full"
                      style={{ background: "var(--v-glow)" }}
                    />
                  ) : null}
                  <span className="w-5">{locale}</span>
                  <span className="text-[var(--text-faint)] normal-case tracking-normal">
                    {t(`lang.${locale}`)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
