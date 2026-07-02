import Link from "next/link";
import type { ReactNode } from "react";
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

// A static, server-rendered backdrop for the docs home: a faint grid fading out at the edges
// and a soft violet wash. No canvas, no perpetual animation, and no next/dynamic(ssr:false),
// so it adds nothing to hydrate and never keeps a reading page busy. The landing keeps the
// animated Backdrop; the docs home stays calm.
function StaticBackdrop(): ReactNode {
  const fade = "radial-gradient(ellipse 75% 65% at 50% 0%, #000 35%, transparent 80%)";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          opacity: 0.4,
          WebkitMaskImage: fade,
          maskImage: fade,
        }}
      />
      <div
        className="absolute left-1/2 top-[-30%] h-[720px] w-[min(1100px,120%)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--v-violet) 22%, transparent), transparent 70%)",
          filter: "blur(30px)",
        }}
      />
    </div>
  );
}

// Full-bleed docs-home hero. The home page renders with a full-width article (page.tsx passes
// max-w-none / px-0 for the home), so this section fills the whole content area between the
// sidebar and the viewport edge, then centers its own content. It mirrors the landing hero:
// static backdrop, gradient headline, the tabbed install card, two CTAs, and the one-shot CLI
// terminal. Localized copy arrives as props from the per-locale MDX.
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
    <section className="not-prose relative w-full overflow-hidden border-b border-fd-border px-6 pt-14 pb-16 md:px-10 xl:pt-20">
      <StaticBackdrop />
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
          className="vk-gradient-text mx-auto mt-5 max-w-[18ch] font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "var(--tracking-tight)",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            lineHeight: 1.06,
            textWrap: "balance",
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

        {/* The one-shot terminal, framed with a soft wash behind it, mirrors the landing. */}
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

// Wraps the below-hero home content in a centered, readable column. The home article runs full
// width (for the hero), so everything after the hero lives inside this container instead.
export function DocsHomeBody({ children }: { children: ReactNode }): ReactNode {
  return <div className="mx-auto w-full max-w-4xl px-6 pt-4 pb-16">{children}</div>;
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
