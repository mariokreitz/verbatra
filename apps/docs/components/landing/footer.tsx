import { SiNpm } from "@icons-pack/react-simple-icons";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { VMark } from "@/components/landing";
import { GithubIcon } from "./github-icon";
import { GITHUB_URL, NPM_CLI, NPM_SDK } from "./links";

// A footer link's text is either a translated catalog key (`labelKey`) or a verbatim proper noun (`literal`).
type FooterLink = { labelKey?: string; literal?: string; href: string; external?: boolean };
type FooterCol = { col: string; titleKey: string; links: ReadonlyArray<FooterLink> };

// Internal hrefs stay unprefixed English routes because docs and legal pages are English-only for now; locale-prefix them once docs content is localized.
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

// Fully static footer, so it stays a server component.
export async function FullFooter(): Promise<ReactNode> {
  const t = await getTranslations("landing.footer");
  return (
    <footer
      className="mt-24 border-t border-fd-border"
      style={{ background: "color-mix(in srgb, var(--v-void) 60%, var(--surface-card))" }}
    >
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
