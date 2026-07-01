import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SectionHead } from "./section-head";
import { Terminal } from "./terminal";

// CLI code is verbatim English and never localized. The sequence walks the real v1
// commands (init, translate, diff, watch) with outputs consistent with the documented
// behavior and the RunSummary fields (translated / unchanged / orphaned / skipped invalid
// icu / withheld).
const COMMANDS = [
  "verbatra init",
  "verbatra translate",
  "verbatra diff",
  "verbatra watch",
] as const;

const OUTPUTS: Readonly<Record<number, ReadonlyArray<string>>> = {
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

// Server shell: the eyebrow/heading/lead render on the server; the animated Terminal is the
// client leaf.
export async function CliShowcase(): Promise<ReactNode> {
  const t = await getTranslations("landing.terminal");
  return (
    <section className="mx-auto mt-24 max-w-5xl px-6">
      <SectionHead
        align="center"
        maxWidth="620px"
        eyebrow={t("eyebrow")}
        title={t("heading")}
        lead={t("lead")}
      />
      <div className="mx-auto mt-12 max-w-[46rem]">
        <Terminal commands={COMMANDS} outputs={OUTPUTS} title="~/acme-shop" />
      </div>
    </section>
  );
}
