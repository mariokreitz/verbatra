import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/landing/fx/backdrop";
import { GithubIcon } from "@/components/landing/github-icon";
import { GITHUB_URL } from "@/components/landing/links";
import { PackageInstall } from "@/components/landing/package-install";
import { StatusBand } from "@/components/landing/status-band";
import { Terminal } from "@/components/landing/terminal";
import Button from "@/components/ui/button";
import { type Locale, localizedPath } from "@/lib/i18n";

const CLI_COMMANDS = [
  "verbatra init",
  "verbatra translate",
  "verbatra diff",
  "verbatra watch",
] as const;

const CLI_OUTPUTS: Readonly<Record<number, ReadonlyArray<string>>> = {
  0: [
    "✓ created verbatra.config.ts",
    "source en · targets de, es, fr",
    "provider anthropic · key from ANTHROPIC_API_KEY",
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
    "es  1 translated · 0 withheld",
    "fr  1 translated · 0 withheld",
    "✓ 3 keys translated · waiting for changes",
  ],
};

export async function LandingHero(): Promise<ReactNode> {
  const t = await getTranslations("landing.hero");
  const locale = (await getLocale()) as Locale;
  return (
    <section className="relative overflow-hidden border-b border-fd-border">
      <Backdrop />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-24">
        <div className="mx-auto max-w-[820px] text-center">
          <h1
            className="mx-auto max-w-[16ch] font-semibold"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "var(--tracking-tight)",
              fontSize: "clamp(2rem, 6vw, 4rem)",
              lineHeight: 1.04,
              textWrap: "balance",
              background: "var(--gradient-headline)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {t("headline")}
          </h1>
          <p className="mx-auto mt-5 max-w-[480px] text-lg leading-relaxed text-fd-muted-foreground">
            {t("lead")}
          </p>
          <div className="mt-7 flex justify-center">
            <PackageInstall />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              href={localizedPath(locale, "/docs/your-first-translation")}
              variant="primary"
              size="lg"
              trailingArrow
            >
              {t("ctaQuickstart")}
            </Button>
            <Button href={GITHUB_URL} variant="secondary" size="lg">
              <GithubIcon size={18} />
              {t("ctaGithub")}
            </Button>
          </div>
          <div className="mt-7">
            <StatusBand variant="inline" />
          </div>
        </div>

        <div className="relative mx-auto mt-14 max-w-[46rem]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "var(--wash-globe)", filter: "blur(12px)" }}
          />
          <div className="relative">
            <Terminal
              commands={CLI_COMMANDS}
              outputs={CLI_OUTPUTS}
              title="~/acme-shop"
              loop={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
