"use client";

import {
  type IconType,
  SiAngular,
  SiAnthropic,
  SiDeepl,
  SiGooglegemini,
  SiNextdotjs,
  SiNodedotjs,
  SiNpm,
  SiNuxt,
  SiReact,
  SiVuedotjs,
} from "@icons-pack/react-simple-icons";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { VMark } from "@/components/landing";
import Button from "@/components/ui/button";
import { PACKAGE_VERSION } from "@/lib/site";
import type { FaqItem } from "@/lib/structured-data";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
const NPM_CLI = "https://www.npmjs.com/package/@verbatra/cli";
const NPM_SDK = "https://www.npmjs.com/package/@verbatra/sdk";

export function Eyebrow({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">
      {children}
    </p>
  );
}

export function SectionHeading({ children }: { children: ReactNode }): ReactNode {
  return (
    <h2
      className="mb-3 text-2xl font-semibold tracking-tight text-fd-foreground md:text-[1.75rem]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
  );
}

// `stars` / `downloads` are already-formatted display strings (locale-grouped integers) passed in
// from the server page, or null when the stat is hidden (below floor, or its build-time fetch
// failed). Both null renders the strip exactly as before (building-block chips only).
export function TrustStrip({
  stars = null,
  downloads = null,
}: {
  stars?: string | null;
  downloads?: string | null;
} = {}): ReactNode {
  const t = useTranslations("landing.trust");
  const items = Object.values(t.raw("items") as Record<string, string>);
  // The unit (chip & stat) shares one type/spacing rule; the qualitative chips and the live stats
  // only differ in their leading mark (glow dot vs. monochrome icon) and value styling.
  const unitClass =
    "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-fd-muted-foreground";
  return (
    <section className="mx-auto max-w-5xl px-6">
      <div className="border-y border-fd-border py-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">
          {t("eyebrow")}
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {/* Group 1 - qualitative building-block chips. The two separate <ul>s give each group
              native list semantics so assistive tech announces them as distinct groups. */}
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {items.map((item) => (
              <li key={item} className={unitClass}>
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
                />
                {item}
              </li>
            ))}
          </ul>

          {/* Quiet divider: a vertical hairline on desktop. It only renders when the stats group
              is non-empty - version is always present, so in practice it always renders. */}
          <span
            aria-hidden="true"
            className="hidden sm:block w-px self-stretch min-h-5 bg-fd-border"
          />

          {/* Group 2 - live proof stats, fixed order: version -> downloads -> stars. Version is
              always present; downloads/stars are build-time snapshots shown only when present.
              On mobile the divider is hidden and this group gets a top rule so the two sets still
              read as distinct after wrapping. */}
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 max-sm:w-full max-sm:border-t max-sm:border-fd-border max-sm:pt-3.5">
            <li
              className={unitClass}
              aria-label={t("stats.versionAria", { version: PACKAGE_VERSION })}
            >
              <TagIcon size={14} className="shrink-0 text-[color:var(--accent)]" />
              <span className="whitespace-nowrap text-fd-foreground">v{PACKAGE_VERSION}</span>
            </li>
            {downloads != null && (
              <li className={unitClass}>
                <SiNpm
                  size={14}
                  color="currentColor"
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--accent)]"
                />
                <span className="text-fd-foreground">{downloads}</span>
                <span>{t("stats.downloadsLabel")}</span>
              </li>
            )}
            {stars != null && (
              <li className={unitClass}>
                <GithubIcon size={14} className="shrink-0 text-[color:var(--accent)]" />
                <span className="text-fd-foreground">{stars}</span>
                <span>{t("stats.starsLabel")}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function GithubIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className ?? "shrink-0"}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

// Simple Icons has no neutral "tag" glyph, so the version stat's leading mark is inlined here
// following the GithubIcon/OpenAiIcon pattern (monochrome, currentColor, no new dep).
function TagIcon({ size = 14, className }: { size?: number; className?: string }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82zM7.5 7.5h.01" />
    </svg>
  );
}

// OpenAI's brand mark is not shipped by Simple Icons, so its logomark is inlined here for the
// "works with" marquee. Monochrome (fill: currentColor), tinted by the chip like the Si chips.
function OpenAiIcon({ size = 16, className }: { size?: number; className?: string }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

const MANAGERS = [
  { id: "pnpm", label: "pnpm", command: "pnpm add -D @verbatra/cli" },
  { id: "npm", label: "npm", command: "npm i -D @verbatra/cli" },
  { id: "yarn", label: "yarn", command: "yarn add -D @verbatra/cli" },
  { id: "bun", label: "bun", command: "bun add -d @verbatra/cli" },
] as const;

export function PackageInstall(): ReactNode {
  const t = useTranslations("landing.install");
  const [active, setActive] = useState<(typeof MANAGERS)[number]["id"]>("pnpm");
  const [copied, setCopied] = useState(false);
  const current = MANAGERS.find((m) => m.id === active) ?? MANAGERS[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context); the command is still visible.
    }
  }

  const tokenAt = current.command.indexOf("@verbatra/cli");

  return (
    <div className="not-prose w-full max-w-[27rem] overflow-hidden rounded-lg border border-fd-border bg-fd-card">
      <div role="tablist" aria-label={t("tablistLabel")} className="flex border-b border-fd-border">
        {MANAGERS.map((m) => {
          const selected = m.id === active;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`px-3.5 py-2 font-mono text-xs lowercase transition-colors ${
                selected
                  ? "text-fd-foreground"
                  : "text-fd-muted-foreground hover:text-fd-foreground"
              }`}
              style={selected ? { boxShadow: "inset 0 -2px 0 var(--v-glow)" } : undefined}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 font-mono text-sm">
        <span className="text-fd-muted-foreground" aria-hidden="true">
          $
        </span>
        <code className="text-fd-foreground">
          {tokenAt >= 0 ? (
            <>
              {current.command.slice(0, tokenAt)}
              <a
                href={NPM_CLI}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => event.stopPropagation()}
                className="rounded underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                @verbatra/cli
              </a>
              {current.command.slice(tokenAt + "@verbatra/cli".length)}
            </>
          ) : (
            current.command
          )}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={t("copyAria")}
          className="ms-auto rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}

type Chip = { name: string; sub: string };

const FRAMEWORK_CHIPS: ReadonlyArray<Chip> = [
  { name: "React", sub: "next-intl" },
  { name: "Next.js", sub: "next-intl" },
  { name: "Vue", sub: "vue-i18n" },
  { name: "Nuxt", sub: "vue-i18n" },
  { name: "Angular", sub: "ngx-translate" },
  { name: "Node.js", sub: "i18next" },
  { name: "i18next", sub: "json" },
  { name: "next-intl", sub: "json" },
  { name: "vue-i18n", sub: "json" },
  { name: "ngx-translate", sub: "json" },
];

// Only 4 unique providers. The track later duplicates whatever it is given (×2), so with the
// marquee band now capped at 1600px we repeat the four providers four times here to guarantee
// each half of the doubled track is wider than the band - otherwise the -50% loop would show a
// gap. The two halves stay identical, so the loop is seamless.
const UNIQUE_PROVIDERS: ReadonlyArray<Chip> = [
  { name: "Anthropic", sub: "LLM" },
  { name: "OpenAI", sub: "LLM" },
  { name: "Gemini", sub: "LLM" },
  { name: "DeepL", sub: "machine translation" },
];

const PROVIDER_CHIPS: ReadonlyArray<Chip> = [
  ...UNIQUE_PROVIDERS,
  ...UNIQUE_PROVIDERS,
  ...UNIQUE_PROVIDERS,
  ...UNIQUE_PROVIDERS,
];

// Brand icons (monochrome, tinted via currentColor on the chip). OpenAI is rendered separately
// from an inlined logomark (see OpenAiIcon) since Simple Icons does not ship it. The remaining
// names without a brand mark (the library/format chips) fall back to the glow dot.
const CHIP_ICONS: Readonly<Record<string, IconType>> = {
  React: SiReact,
  "Next.js": SiNextdotjs,
  Vue: SiVuedotjs,
  Nuxt: SiNuxt,
  Angular: SiAngular,
  "Node.js": SiNodedotjs,
  Anthropic: SiAnthropic,
  Gemini: SiGooglegemini,
  DeepL: SiDeepl,
};

function MarqueeChip({ chip }: { chip: Chip }): ReactNode {
  const Icon = CHIP_ICONS[chip.name];
  return (
    <span className="mx-2 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-fd-border bg-fd-card px-4 py-2">
      {Icon ? (
        <Icon
          size={16}
          color="currentColor"
          aria-hidden="true"
          className="shrink-0 text-[color:var(--accent)]"
        />
      ) : chip.name === "OpenAI" ? (
        <OpenAiIcon size={16} className="shrink-0 text-[color:var(--accent)]" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
        />
      )}
      <span
        className="text-sm font-semibold text-fd-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {chip.name}
      </span>
      <span className="font-mono text-[11px] text-fd-muted-foreground">{chip.sub}</span>
    </span>
  );
}

export function MarqueeBand({
  chips,
  direction,
  duration,
  label,
}: {
  chips: ReadonlyArray<Chip>;
  direction: "left" | "right";
  duration: number;
  label: string;
}): ReactNode {
  const animation = `vk-marquee-${direction} ${duration}s linear infinite`;
  return (
    <div className="vk-band py-2">
      {/* One readable list for assistive tech; the visual track below is duplicated and hidden. */}
      <ul className="sr-only">
        <li>{label}:</li>
        {chips.map((chip, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the chip list is static and intentionally contains duplicate name/sub pairs, so the index disambiguates.
          <li key={`${chip.name}-${chip.sub}-${i}`}>
            {chip.name} ({chip.sub})
          </li>
        ))}
      </ul>
      <div className="vk-track" style={{ animation }} aria-hidden="true">
        {chips.map((chip, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, duplicated chip list; index disambiguates the doubled track.
          <MarqueeChip key={`a-${chip.name}-${i}`} chip={chip} />
        ))}
        {chips.map((chip, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, duplicated chip list; index disambiguates the doubled track.
          <MarqueeChip key={`b-${chip.name}-${i}`} chip={chip} />
        ))}
      </div>
    </div>
  );
}

export function Compatibility(): ReactNode {
  const t = useTranslations("landing.compat");
  return (
    <section className="mt-24">
      <div className="mx-auto max-w-5xl px-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <SectionHeading>{t("heading")}</SectionHeading>
        <p className="mb-8 max-w-[52ch] text-fd-muted-foreground">{t("body")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <MarqueeBand
          chips={FRAMEWORK_CHIPS}
          direction="left"
          duration={34}
          label={t("labelFrameworks")}
        />
        <MarqueeBand
          chips={PROVIDER_CHIPS}
          direction="right"
          duration={26}
          label={t("labelProviders")}
        />
      </div>
    </section>
  );
}

type Step = { title: string; body: string };

export function HowItWorks(): ReactNode {
  const t = useTranslations("landing.how");
  const steps = Object.values(t.raw("steps") as Record<string, Step>);
  return (
    <section className="mx-auto mt-24 max-w-5xl px-6">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <SectionHeading>{t("heading")}</SectionHeading>
      <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.title} className="border-l border-fd-border pl-5">
            <div
              className="mb-3 font-mono text-sm text-[color:var(--accent)]"
              style={{ textShadow: "var(--glow-mark)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3
              className="mb-2 text-base font-semibold text-fd-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-fd-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type Reason = { title: string; body: string };

export function WhyUse(): ReactNode {
  const t = useTranslations("landing.why");
  const reasons = Object.values(t.raw("reasons") as Record<string, Reason>);
  return (
    <section className="mx-auto mt-24 max-w-5xl px-6">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <SectionHeading>{t("heading")}</SectionHeading>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reasons.map((reason) => (
          <div
            key={reason.title}
            className="not-prose rounded-2xl border border-fd-border bg-fd-card p-5 text-fd-foreground"
          >
            <h3
              className="mb-2 text-base font-semibold text-fd-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {reason.title}
            </h3>
            <p className="text-sm leading-relaxed text-fd-muted-foreground">{reason.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// The items are passed in from the server page, which reads them once from the catalog and feeds
// the same array to the FAQPage JSON-LD, so the visible accordion and the structured data share
// one source and never drift.
export function Faq({ items }: { items: ReadonlyArray<FaqItem> }): ReactNode {
  const t = useTranslations("landing.faq");
  const [open, setOpen] = useState(0);

  return (
    <section className="mx-auto mt-24 max-w-3xl px-6">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <SectionHeading>{t("heading")}</SectionHeading>
      <div className="mt-8 divide-y divide-fd-border border-y border-fd-border">
        {items.map((item, i) => {
          const isOpen = open === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;
          return (
            <div key={item.question}>
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold text-fd-foreground transition-colors hover:text-[color:var(--accent)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-lg text-[color:var(--accent)] transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </span>
                </button>
              </h3>
              <section
                id={panelId}
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: isOpen ? "20rem" : "0" }}
              >
                <p className="max-w-[60ch] pb-5 text-sm leading-relaxed text-fd-muted-foreground">
                  {item.answer}
                </p>
              </section>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// A footer link's visible text is either a catalog key under `landing.footer.cols.<col>`
// (human labels, translated) or a literal proper noun (brand/package names, kept verbatim).
type FooterLink = { labelKey?: string; literal?: string; href: string; external?: boolean };
type FooterCol = { col: string; titleKey: string; links: ReadonlyArray<FooterLink> };

// Internal hrefs point at the canonical (unprefixed) English routes: /docs and the legal pages
// are English-only for now (docs content i18n is deferred), and `fallbackLanguage: "en"` would
// only ever serve English under a /de prefix anyway, so prefixing them would route a localized
// reader to a fallback page for no gain. The link labels are translated; the targets stay
// canonical. When docs content is localized, locale-prefix these here.
const FOOTER_COLS: ReadonlyArray<FooterCol> = [
  {
    col: "product",
    titleKey: "cols.product.title",
    links: [
      { labelKey: "cols.product.documentation", href: "/docs" },
      { labelKey: "cols.product.cliReference", href: "/docs/cli" },
      { labelKey: "cols.product.sdk", href: "/docs/sdk" },
      { labelKey: "cols.product.githubAction", href: "/docs/github-action" },
    ],
  },
  {
    col: "learn",
    titleKey: "cols.learn.title",
    links: [
      { labelKey: "cols.learn.howItWorks", href: "/docs/how-it-works" },
      { labelKey: "cols.learn.providers", href: "/docs/providers" },
      { labelKey: "cols.learn.formats", href: "/docs/formats" },
      { labelKey: "cols.learn.lockFile", href: "/docs/the-lock-file" },
    ],
  },
  {
    col: "project",
    titleKey: "cols.project.title",
    links: [
      { labelKey: "cols.project.configFile", href: "/docs/config-file" },
      { literal: "GitHub", href: GITHUB_URL, external: true },
      { literal: "@verbatra/cli", href: NPM_CLI, external: true },
      { literal: "@verbatra/sdk", href: NPM_SDK, external: true },
    ],
  },
  {
    col: "legal",
    titleKey: "cols.legal.title",
    links: [
      { literal: "MIT License", href: `${GITHUB_URL}/blob/main/LICENSE`, external: true },
      { labelKey: "cols.legal.privacy", href: "/privacy" },
      { labelKey: "cols.legal.imprint", href: "/imprint" },
    ],
  },
];

function FooterLinkItem({ link, label }: { link: FooterLink; label: string }): ReactNode {
  const className = "transition-colors hover:text-fd-foreground";
  if (link.external) {
    return (
      <a href={link.href} className={className} target="_blank" rel="noreferrer noopener">
        {label}
      </a>
    );
  }
  return (
    <a href={link.href} className={className}>
      {label}
    </a>
  );
}

export function FullFooter(): ReactNode {
  const t = useTranslations("landing.footer");
  return (
    <footer className="mt-24 border-t border-fd-border">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <span className="inline-flex items-center gap-2">
              <VMark size={28} />
              <span
                className="text-lg font-semibold tracking-tight text-fd-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                verbatra
              </span>
            </span>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-fd-muted-foreground">
              {t("tagline")}
            </p>
            <div className="mt-4 flex items-center gap-5">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("githubAria")}
                className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
              >
                <GithubIcon size={16} />
                <span>GitHub</span>
              </a>
              <a
                href={NPM_CLI}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("npmAria")}
                className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
              >
                <SiNpm size={16} color="currentColor" aria-hidden="true" className="shrink-0" />
                <span>npm</span>
              </a>
            </div>
          </div>
          {FOOTER_COLS.map((col) => {
            const title = t(col.titleKey);
            return (
              <nav key={col.col} aria-label={title}>
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-fd-muted-foreground">
                  {title}
                </p>
                <ul className="flex flex-col gap-2.5 text-sm text-fd-muted-foreground">
                  {col.links.map((link) => (
                    <li key={link.literal ?? link.labelKey}>
                      <FooterLinkItem link={link} label={link.literal ?? t(link.labelKey ?? "")} />
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-fd-border pt-6 text-sm text-fd-muted-foreground">
          <span>{t("legalLine")}</span>
        </div>
      </div>
    </footer>
  );
}

export function FinalClose(): ReactNode {
  const t = useTranslations("landing.finalClose");
  const tHero = useTranslations("landing.hero");
  return (
    <section className="relative mx-auto mt-24 max-w-3xl px-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--wash-globe)" }}
      />
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <h2
        className="mx-auto mb-8 max-w-[20ch] text-3xl font-semibold tracking-tight text-fd-foreground md:text-4xl"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em" }}
      >
        {t("heading")}
      </h2>
      <div
        className="not-prose mx-auto mb-8 max-w-xl overflow-hidden rounded-2xl border border-fd-border bg-fd-card text-left"
        style={{
          borderInlineStart: "2px solid var(--v-glow)",
          boxShadow: "var(--shadow-panel-lg)",
        }}
      >
        <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--border-default)" }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--border-default)" }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--border-default)" }}
            />
          </span>
          <span className="font-mono text-xs text-fd-muted-foreground">~/acme-shop</span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed">
          <code>
            <span style={{ color: "var(--v-glow)" }}>$</span>{" "}
            <span className="text-fd-foreground">verbatra translate</span>
            {"\n"}
            <span className="text-fd-muted-foreground">source en.json · 10 keys</span>
            {"\n"}
            <span className="text-fd-muted-foreground">diff · 7 new · 1 changed · 2 unchanged</span>
            {"\n"}
            <span style={{ color: "var(--v-glow)" }}>de</span>{" "}
            <span className="text-fd-muted-foreground">3 translated</span>
            {"\n"}
            <span style={{ color: "var(--v-glow)" }}>fr</span>{" "}
            <span className="text-fd-muted-foreground">3 translated</span>
            {"\n"}
            <span style={{ color: "var(--v-glow)" }}>es</span>{" "}
            <span className="text-fd-muted-foreground">3 translated</span>
            {"\n"}
            <span style={{ color: "var(--v-pink)" }}>ja</span>{" "}
            <span className="text-fd-muted-foreground">1 changed</span>
            {"\n"}
            <span style={{ color: "var(--v-glow)" }}>
              ✓ 10 keys translated in 4.2s · 0 withheld · lock updated
            </span>
          </code>
        </pre>
      </div>
      <div className="flex flex-col items-center gap-5">
        <PackageInstall />
        <Button href="/docs" variant="primary" size="lg" trailingArrow>
          {tHero("ctaStart")}
        </Button>
      </div>
    </section>
  );
}
