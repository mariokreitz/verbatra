import Link from "next/link";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/landing/fx/backdrop";
import { PackageInstall } from "@/components/landing/package-install";
import { Terminal } from "@/components/landing/terminal";

// The docs home reuses the marketing hero's terminal script: the real v1 commands with
// outputs consistent with the documented RunSummary fields. CLI is verbatim English and is
// never localized, so it lives in the component rather than in the localized MDX.
const HERO_COMMANDS = [
  "verbatra init",
  "verbatra translate",
  "verbatra diff",
  "verbatra watch",
] as const;

const HERO_OUTPUTS: Readonly<Record<number, ReadonlyArray<string>>> = {
  0: [
    "✓ created verbatra.config.ts",
    "source en · targets de, es, fr",
    "provider gemini · key from GEMINI_API_KEY",
  ],
  1: [
    "diff en.json · 12 new · 0 changed · 108 unchanged",
    "de  12 translated · 108 unchanged · 0 withheld",
    "es  12 translated · 108 unchanged · 0 withheld",
    "fr  12 translated · 108 unchanged · 0 withheld",
    "✓ 36 keys translated in 5.4s · 0 skipped · lock updated",
  ],
  2: [
    "en.json · 120 keys · source of truth",
    "de  2 new · 1 changed · 117 up to date",
    "es  0 new · 0 changed · 120 up to date",
    "fr  5 new · 0 changed · 115 up to date",
    "8 keys would be sent · run verbatra translate to apply",
  ],
  3: [
    "watching en.json for changes",
    "en.json changed · 1 new key",
    "de  1 translated · 0 withheld",
    "✓ 3 keys translated · waiting for changes",
  ],
};

// Full-bleed docs-home hero. It breaks out of the DocsPage article padding
// (px-4 md:px-6 xl:px-8, pt-6 md:pt-8 xl:pt-14) with matching negative margins so the
// backdrop wash reaches the content-area edges, then re-insets its own content. It mirrors
// the landing hero: animated backdrop, gradient headline, the tabbed install card, two CTAs,
// and the looping CLI terminal. Localized copy arrives as props from the per-locale MDX.
export function DocsHomeHero({
  eyebrow,
  headline,
  lead,
  primary,
  secondary,
}: {
  eyebrow: string;
  headline: string;
  lead: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}): ReactNode {
  return (
    <section className="not-prose relative -mx-4 -mt-6 mb-10 overflow-hidden border-b border-fd-border px-6 pt-14 pb-16 md:-mx-6 md:-mt-8 md:px-10 xl:-mx-8 xl:-mt-14 xl:pt-20">
      <Backdrop />
      <div className="relative mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{
              filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--v-glow) 60%, transparent))",
            }}
          >
            <path
              d="M4 4 L12 20 L20 4"
              stroke="var(--v-glow)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {eyebrow}
        </div>
        <h1
          className="mx-auto mt-5 max-w-[18ch] font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "var(--tracking-tight)",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            lineHeight: 1.06,
            textWrap: "balance",
            background: "var(--gradient-headline)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {headline}
        </h1>
        <p className="mx-auto mt-5 max-w-[54ch] text-lg leading-relaxed text-fd-muted-foreground">
          {lead}
        </p>
        <div className="mt-7 flex justify-center">
          <PackageInstall />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primary.href}
            className="group inline-flex items-center gap-2 rounded-[10px] px-[22px] py-[13px] text-base font-semibold text-[color:var(--accent-fill-fg)] transition-[filter] hover:brightness-[1.08]"
            style={{ background: "var(--accent-fill)" }}
          >
            {primary.label}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex items-center gap-2 rounded-[10px] border border-fd-border px-[22px] py-[13px] text-base font-semibold text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            {secondary.label}
          </Link>
        </div>

        {/* The looping terminal, framed with a globe-glow wash behind it, mirrors the landing. */}
        <div className="relative mx-auto mt-12 max-w-[44rem]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "var(--wash-globe)", filter: "blur(12px)" }}
          />
          <div className="relative text-left">
            <Terminal
              commands={HERO_COMMANDS}
              outputs={HERO_OUTPUTS}
              title="~/acme-shop"
              loop={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type PathCard = {
  href: string;
  tag: string;
  label: string;
  body: string;
  primary?: boolean;
};

// The three entry lanes on the docs home, phrased by where the reader already is.
// One primary (filled) card leads; the rest are outlined and share the hover accent.
export function DocsHomePaths({ cards }: { cards: ReadonlyArray<PathCard> }): ReactNode {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className={
            card.primary
              ? "group flex flex-col gap-2 rounded-xl p-5 transition-[filter] hover:brightness-110"
              : "group flex flex-col gap-2 rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
          }
          style={
            card.primary ? { background: "var(--v-purple)", color: "hsl(290 60% 98%)" } : undefined
          }
        >
          <span
            className="font-mono text-xs tracking-wide"
            style={{
              color: card.primary ? "hsl(290 60% 92%)" : "var(--color-fd-muted-foreground)",
            }}
          >
            {card.tag}
          </span>
          <span className="flex items-center gap-1 font-medium">
            {card.label}
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
              style={card.primary ? undefined : { color: "var(--v-glow)" }}
            >
              →
            </span>
          </span>
          <span
            className="text-sm leading-relaxed"
            style={{
              color: card.primary ? "hsl(290 40% 90%)" : "var(--color-fd-muted-foreground)",
            }}
          >
            {card.body}
          </span>
        </Link>
      ))}
    </div>
  );
}

// A compact feature card grid summarizing what verbatra does, used below the quick start.
export function DocsHomeFeatures({
  features,
}: {
  features: ReadonlyArray<{ title: string; body: string }>;
}): ReactNode {
  return (
    <div className="not-prose my-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {features.map((feature) => (
        <div
          key={feature.title}
          className="rounded-xl border border-fd-border bg-fd-card p-4"
          style={{ borderInlineStart: "2px solid var(--v-glow)" }}
        >
          <div className="font-medium text-fd-foreground">{feature.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">{feature.body}</p>
        </div>
      ))}
    </div>
  );
}
